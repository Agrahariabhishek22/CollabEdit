import { randomUUID } from "crypto";
import fs from "fs";
import path from "node:path";
import { simpleGit } from "simple-git";
import { asyncHandler, AppError } from "../middlewares/errorHandler.js";
import { prisma } from "../config/database.js";
import { getRedisClient } from "../config/redis.js";
import { getIO } from "../config/socketio.js";
import { fileURLToPath } from "url";
import { acquireBranchLock, releaseBranchLock } from "./gitController.js";

// ============================================================================
// CONTROLLER: Create New Branch
// ============================================================================

/**
 * POST /api/git/:projectId/create-branch
 * Create a new branch from existing branch
 *
 * Request Body:
 * {
 *   branchName: "feat-new-feature",
 *   sourceBranch: "main" // Optional, defaults to current branch
 * }
 *
 * Process:
 * 1. Validate branch name (no spaces, special chars)
 * 2. Verify branch doesn't already exist
 * 3. Checkout source branch
 * 4. Create new branch (git checkout -b)
 * 5. Update project.currentBranch in DB
 * 6. Broadcast to all collaborators
 */
export const createBranch = asyncHandler(async (req, res) => {
  const io = getIO();
  const { projectId } = req.params;
  const { branchName, sourceBranch } = req.body;
  const userId = req.user.id;

  // Validation
  if (!branchName) {
    throw new AppError("Branch name is required", 400);
  }

  // Branch name validation (no spaces, no special chars except - and _)
  const branchNameRegex = /^[a-zA-Z0-9._\-/]+$/;
  if (!branchNameRegex.test(branchName)) {
    throw new AppError(
      "Branch name can only contain letters, numbers, dots, hyphens, underscores, and slashes",
      400,
    );
  }

  try {
    // Step 1: Verify project exists and user has permission
    const lockAcquired = await acquireBranchLock(projectId);
    if (!lockAcquired) {
      throw new AppError(
        "Branch switch already in progress. Please wait and try again.",
        409,
      );
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new AppError("Project not found", 404);
    }

    // Check if user has ADMIN or EDITOR permission
    const userRole = await prisma.collaboratorDetail.findFirst({
      where: {
        fileMetaId: project.rootFileMetaId,
        adminId: userId,
      },
    });

    if (!userRole) {
      throw new AppError(
        "You do not have permission to create branches in this project",
        403,
      );
    }

    console.log(
      `[GitController] Creating branch '${branchName}' in project ${projectId}`,
    );

    // Step 2: Initialize git repo
    const repo = simpleGit(project.rootPath);

    // Step 3: Get all branches to check if new branch already exists
    const allBranches = await repo.branch(["-a"]);
    const branchExists = allBranches.all.some(
      (b) => b.replace("remotes/origin/", "") === branchName,
    );

    if (branchExists) {
      throw new AppError(`Branch '${branchName}' already exists`, 409);
    }

    // Step 4: Determine source branch
    // If sourceBranch not provided, use current branch
    const sourceToUseForCheckout =
      sourceBranch || project.currentBranch || "main";

    console.log(
      `[GitController] Using '${sourceToUseForCheckout}' as source branch`,
    );

    // Step 5: Checkout to source branch first (if different from current)
    if (sourceToUseForCheckout !== project.currentBranch) {
      await repo.checkout(sourceToUseForCheckout);
      console.log(
        `[GitController] Checked out to ${sourceToUseForCheckout} to create new branch`,
      );
    }

    // Step 6: Create new branch (this also checks it out)
    await repo.checkoutLocalBranch(branchName);

    console.log(`[GitController] Branch '${branchName}' created successfully`);

    // Step 7: Update project's current branch in DB
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { currentBranch: branchName },
    });

    console.log(
      `[GitController] Updated project current branch to ${branchName}`,
    );

    // Step 8: Broadcast to all collaborators
    io.to(`project-${projectId}`).emit("git:branch-created", {
      projectId,
      branch: branchName,
      sourceBranch: sourceToUseForCheckout,
      createdBy: userId,
      timestamp: new Date().toISOString(),
    });

    console.log(
      `[GitController] Broadcasted: git:branch-created for ${branchName}`,
    );

    res.status(201).json({
      success: true,
      message: `Branch '${branchName}' created successfully`,
      projectId,
      branch: branchName,
      sourceBranch: sourceToUseForCheckout,
    });
  } catch (err) {
    console.error(`[GitController] Create branch failed:`, err);
    throw new AppError(`Failed to create branch: ${err.message}`, 500);
  } finally {
    // Always release lock
    await releaseBranchLock(projectId);
    console.log(`[GitController] Branch lock released for ${projectId}`);
  }
});

// ============================================================================
// CONTROLLER: Push Branch to Remote
// ============================================================================

/**
 * POST /api/git/:projectId/push
 * Push current branch to remote repository
 *
 * Request Body:
 * {
 *   branch: "feat-new-feature", // Optional, defaults to current branch
 *   force: false // Optional, dangerous if true
 * }
 *
 * Process:
 * 1. Verify project exists
 * 2. Check if branch exists locally
 * 3. Execute git push origin branch
 * 4. Handle credentials if needed (GitHub tokens, SSH keys)
 * 5. Broadcast success to all collaborators
 */
export const pushBranch = asyncHandler(async (req, res) => {
  const io = getIO();
  const { projectId } = req.params;
  const { branch, force } = req.body;
  const userId = req.user.id;

  try {
    // Step 1: Verify project exists and user has permission
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { rootFileMetaId: true },
    });

    if (!project) {
      throw new AppError("Project not found", 404);
    }

    // Check if user has ADMIN or EDITOR permission
    const userRole = await prisma.collaboratorDetail.findFirst({
      where: {
        fileMetaId: project.rootFileMetaId,
        adminId: userId,
      },
    });

    if (!userRole) {
      throw new AppError(
        "You do not have permission to push in this project",
        403,
      );
    }

    // Use provided branch or current branch
    const branchToPush = branch || project.currentBranch || "main";

    console.log(
      `[GitController] Pushing branch '${branchToPush}' in project ${projectId}`,
    );

    // Step 2: Initialize git repo
    const repo = simpleGit(project.rootPath);

    // Step 3: Verify branch exists locally
    const allBranches = await repo.branch();
    const branchExists = allBranches.all.includes(branchToPush);

    if (!branchExists) {
      throw new AppError(`Local branch '${branchToPush}' does not exist`, 404);
    }

    // Step 4: Build push command
    // If force is true, use -f (dangerous but sometimes necessary)
    const pushOptions = force ? ["-f"] : [];

    console.log(`[GitController] Executing: git push origin ${branchToPush}`);

    // Step 5: Execute git push
    try {
      const pushResult = await repo.push("origin", branchToPush, pushOptions);
      console.log(`[GitController] Push successful:`, pushResult);
    } catch (pushErr) {
      // Handle specific git errors
      if (pushErr.message.includes("Permission denied")) {
        throw new AppError(
          "Permission denied. Check your Git credentials or SSH keys.",
          403,
        );
      }
      if (pushErr.message.includes("non-fast-forward")) {
        throw new AppError(
          "Push failed: remote branch has changes. Pull first, then push again.",
          409,
        );
      }
      throw pushErr;
    }

    // Step 6: Broadcast to all collaborators
    io.to(`project-${projectId}`).emit("git:push-complete", {
      projectId,
      branch: branchToPush,
      pushedBy: userId,
      timestamp: new Date().toISOString(),
      message: `${branchToPush} pushed to remote successfully`,
    });

    console.log(`[GitController] Broadcasted: git:push-complete`);

    res.json({
      success: true,
      message: `Branch '${branchToPush}' pushed successfully`,
      projectId,
      branch: branchToPush,
    });
  } catch (err) {
    console.error(`[GitController] Push failed:`, err);
    throw new AppError(`Failed to push: ${err.message}`, 500);
  }
});

// ============================================================================
// CONTROLLER: Get Commit History
// ============================================================================

/**
 * GET /api/git/:projectId/commits?limit=50&offset=0
 * Fetch commit history for current branch
 *
 * Query Params:
 * - limit: number of commits to fetch (default: 50)
 * - offset: pagination offset (default: 0)
 *
 * Returns:
 * {
 *   commits: [
 *     {
 *       hash: "abc123",
 *       author: "John Doe",
 *       email: "john@example.com",
 *       message: "feat: add new feature",
 *       date: "2025-02-09T10:30:00Z",
 *       refs: "HEAD -> main, origin/main"
 *     }
 *   ],
 *   total: 100,
 *   hasMore: true
 * }
 */
export const getCommitHistory = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { limit = 50, offset = 0, branch } = req.query;
  // const userId = req.user.id; // Agar use nahi ho raha toh remove kar sakte ho

  try {
    const lockAcquired = await acquireBranchLock(projectId);
    if (!lockAcquired) {
      throw new AppError("Branch switch in progress. Please wait...", 409);
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new AppError("Project not found", 404);

    const repo = simpleGit(project.rootPath);
    const branchToCheck = branch || project.currentBranch || "main";

    // Step 3: Get commit log using simple-git's internal parser (More reliable than raw split)
    // Step 3: Raw command (Is order mein likhna, ye safest hai)
    const logOptions = [
      "log",
      branchToCheck, // Target branch
      "--pretty=format:%H|%an|%ae|%s|%aI|%D", // Custom format
      `--max-count=${parseInt(limit)}`,
      `--skip=${parseInt(offset)}`,
    ];

    console.log(`[GitController] Running: git ${logOptions.join(" ")}`);

    const logOutput = await repo.raw(logOptions);

    // Debugging ke liye: console.log(`[GitController] Raw Output: "${logOutput}"`);

    if (!logOutput || logOutput.trim() === "") {
      console.log("[GitController] No commits found for this branch.");
      return res.json({
        success: true,
        commits: [],
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: false,
      });
    }

    // Parsing logic (Thoda more robust)
    const commits = logOutput
      .trim()
      .split("\n")
      .map((line) => {
        const [hash, author, email, message, date, refs] = line.split("|");
        return {
          hash: hash?.substring(0, 7) || "",
          fullHash: hash || "",
          author: author || "Unknown",
          email: email || "",
          message: message || "",
          date: date || "",
          refs: refs || "",
        };
      });

    // Step 4: Total count remains the same
    const totalCountOutput = await repo.raw([
      "rev-list",
      "--count",
      branchToCheck,
    ]);
    const total = parseInt(totalCountOutput.trim()) || 0;

    const hasMore = parseInt(offset) + parseInt(limit) < total;

    res.json({
      success: true,
      commits,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore,
    });
  } catch (err) {
    console.error(`[GitController] Fetch commit history failed:`, err);
    // Important: Git error parse karna agar branch exist na karti ho
    if (err.message.includes("ambiguous argument")) {
      throw new AppError(`Branch '${branchToCheck}' not found on server.`, 404);
    }
    throw new AppError(`Failed to fetch commits: ${err.message}`, 500);
  } finally {
    await releaseBranchLock(projectId);
  }
});
// ============================================================================
// CONTROLLER: Get Commit Details / Diff
// ============================================================================

/**
 * GET /api/git/:projectId/commits/:commitHash/diff
 * Get diff for a specific commit
 *
 * Returns:
 * {
 *   commit: {
 *     hash, author, message, date, ...
 *   },
 *   diff: "diff --git a/file.js b/file.js..."
 *   filesChanged: [
 *     { path: "file.js", status: "M", additions: 5, deletions: 2 }
 *   ]
 * }
 */
export const getCommitDiff = asyncHandler(async (req, res) => {
  const { projectId, commitHash } = req.params;

  try {
    // 1. Project dhoondo
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new AppError("Project not found", 404);
    }

    console.log(`[GitController] Fetching diff for commit ${commitHash}`);

    const repo = simpleGit(project.rootPath);

    // 2. Commit Meta Data (Author, Date, Message)
    // -s flag se diff hide ho jata hai, sirf summary milti hai
    const commitLog = await repo.raw([
      "show",
      "-s",
      "--format=%H|%an|%ae|%s|%aI",
      commitHash,
    ]);

    if (!commitLog) {
      throw new AppError(`Commit ${commitHash} not found`, 404);
    }

    const [hash, author, email, message, date] = commitLog.trim().split("|");

    // 3. Get Unified Diff Content
    // --format= se header hat jata hai, seedha diff data milta hai
    // Frontend libraries isi format ko parse karti hain
    const diff = await repo.show([
      commitHash,
      "--patch",
      "--format=", // Important: Headers skip karo
    ]);

    // 4. Get File Stats (Additions/Deletions per file)
    const statsOutput = await repo.raw([
      "show",
      commitHash,
      "--numstat",
      "--format=",
    ]);

    const filesChanged = statsOutput
      .split("\n")
      .filter((line) => line.trim() && line.includes("\t"))
      .map((line) => {
        const [additions, deletions, filepath] = line.split("\t");
        return {
          path: filepath,
          additions: parseInt(additions) || 0,
          deletions: parseInt(deletions) || 0,
        };
      });

    // 5. Final Response
    res.json({
      success: true,
      commit: {
        hash: hash?.substring(0, 7) || "",
        fullHash: hash,
        author,
        email,
        message,
        date,
      },
      diff, // Ye pura raw diff string hai
      filesChanged,
      stats: {
        totalFiles: filesChanged.length,
        totalAdditions: filesChanged.reduce((sum, f) => sum + f.additions, 0),
        totalDeletions: filesChanged.reduce((sum, f) => sum + f.deletions, 0),
      },
    });
  } catch (err) {
    console.error(`[GitController] Fetch commit diff failed:`, err);
    throw new AppError(`Failed to fetch commit diff: ${err.message}`, 500);
  }
});

// ============================================================================
// CONTROLLER: Commit Changes
// ============================================================================

/**
 * POST /api/git/:projectId/commit
 * Commit staged changes to current branch
 *
 * Request Body:
 * {
 *   message: "feat: add new feature",
 *   description: "Optional long description" // optional
 *  name,email
 * }
 *
 * Process:
 * 1. Validate commit message
 * 2. Verify user has permission
 * 3. Check if there are changes to commit
 * 4. Get user details for git author info
 * 5. Configure git user (name, email)
 * 6. Stage all changes (git add .)
 * 7. Create commit with proper attribution
 * 8. Update FileMeta records with latest changes
 * 9. Broadcast to all collaborators
 *
 * Attribution:
 * - Author: Current logged-in user (from database)
 * - Email: User's email from profile
 * - Commit message includes: "feat: add feature"
 * - Extended info includes: timestamp, userId, userName
 */
export const commitChanges = asyncHandler(async (req, res) => {
  const io = getIO();
  const { projectId } = req.params;
  const { message, description, name, email } = req.body;
  const userId = req.user.id;

  // Validation
  if (!message || !message.trim()) {
    throw new AppError("Commit message is required", 400);
  }

  if (message.length > 500) {
    throw new AppError("Commit message must be less than 500 characters", 400);
  }

  try {
    // Step 1: Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new AppError("Project not found", 404);
    }

    const userRole = await prisma.collaboratorDetail.findFirst({
      where: {
        fileMetaId: project.rootFileMetaId,
        OR: [
          { adminId: userId }, // Option 1: User Admin hai
          { editors: { has: userId } }, // Option 2: User Editors array mein hai
        ],
      },
    });

    if (!userRole) {
      throw new AppError(
        "You do not have permission to commit in this project",
        403,
      );
    }
    const lockAcquired = await acquireBranchLock(projectId);
    if (!lockAcquired) {
      throw new AppError(
        "Branch switch already in progress. Please wait and try again.",
        409,
      );
    }

    console.log(`[GitController] Committing to project ${projectId}`);

    // Step 2: Get user details for attribution
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const authorName = name || user.name || "Unknown User";
    const authorEmail = email || user.email || "noemail@example.com";

    console.log(`[GitController] Author: ${authorName} <${authorEmail}>`);

    // Step 3: Initialize git repo
    const repo = simpleGit(project.rootPath);

    // Step 4: Check if there are any changes to commit
    const status = await repo.status();

    // if (status.files.length === 0 && status.staged.length === 0) {
    //   throw new AppError(
    //     "No changes to commit. Please make changes first.",
    //     400,
    //   );
    // }

    console.log(
      `[GitController] Found ${status.files.length + status.staged.length} changed files`,
    );

    // Step 5: Configure git user for this commit
    // Important: Git needs to know who's making the commit
    await repo.raw(["config", "user.name", authorName]);
    await repo.raw(["config", "user.email", authorEmail]);

    console.log(`[GitController] Git user configured: ${authorName}`);

    // Step 6: Stage all changes
    await repo.add(".");

    console.log(`[GitController] All changes staged`);

    // Step 7: Create commit with proper message
    // If description provided, add it as commit body
    const fullMessage = description ? `${message}\n\n${description}` : message;

    const commitHash = await repo.commit(fullMessage, [
      "--author",
      `"${authorName} <${authorEmail}>"`,
    ]);

    console.log(`[GitController] Commit created: ${commitHash.commit}`);

    // Step 8: Get commit details for response and broadcast
    const commitLog = await repo.log({ maxCount: 1 });
    const latestCommit = commitLog.latest;

    // Step 9: Update file metadata with new commit info
    // Mark all changed files with latest commit hash
    const changedFiles = [...status.files, ...status.staged];

    if (changedFiles.length > 0) {
      await prisma.fileMeta.updateMany({
        where: {
          projectId,
          absolutePath: {
            in: changedFiles.map((f) =>
              path.join(project.rootPath, f.path || f),
            ),
          },
        },
        data: {
          updatedAt: new Date(),
          // Optional: you can store metadata about last commit
          // lastCommitHash: commitHash.commit,
          // lastModifiedBy: userId,
        },
      });
    }

    console.log(`[GitController] Updated ${changedFiles.length} file records`);

    // Step 10: Broadcast to all collaborators
    io.to(`project-${projectId}`).emit("git:commit-created", {
      projectId,
      commitHash: commitHash.commit,
      shortHash: commitHash.commit.substring(0, 7),
      message,
      description,
      author: authorName,
      authorId: userId,
      email: authorEmail,
      timestamp: new Date().toISOString(),
      filesChanged: changedFiles.length,
      branch: project.currentBranch,
    });

    console.log(`[GitController] Broadcasted: git:commit-created`);

    // Step 11: Return response
    res.status(201).json({
      success: true,
      message: "Changes committed successfully",
      projectId,
      commit: {
        hash: commitHash.commit.substring(0, 7),
        fullHash: commitHash.commit,
        message,
        description,
        author: authorName,
        authorId: userId,
        email: authorEmail,
        timestamp: new Date().toISOString(),
        filesChanged: changedFiles.length,
        branch: project.currentBranch,
      },
    });
  } catch (err) {
    console.error(`[GitController] Commit failed:`, err);

    // Handle specific git errors
    if (err.message?.includes("ENOENT")) {
      throw new AppError(
        "Project directory not found. Repository may have been deleted.",
        404,
      );
    }

    throw new AppError(`Failed to commit: ${err.message}`, 500);
  } finally {
    // Always release lock
    await releaseBranchLock(projectId);
    console.log(`[GitController] Branch lock released for ${projectId}`);
  }
});

// ============================================================================
// HELPER: Get commit count for branch
// ============================================================================

/**
 * GET /api/git/:projectId/commit-count
 * Get number of commits ahead/behind remote
 *
 * Returns:
 * {
 *   ahead: 3,
 *   behind: 0,
 *   totalLocal: 45
 * }
 */
export const getCommitCount = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new AppError("Project not found", 404);
    }

    const repo = simpleGit(project.rootPath);
    const currentBranch = project.currentBranch || "main";

    // Get commits ahead of remote
    const aheadOutput = await repo.raw([
      "rev-list",
      "--count",
      `origin/${currentBranch}..HEAD`,
    ]);
    const ahead = parseInt(aheadOutput.trim()) || 0;

    // Get commits behind remote
    const behindOutput = await repo.raw([
      "rev-list",
      "--count",
      `HEAD..origin/${currentBranch}`,
    ]);
    const behind = parseInt(behindOutput.trim()) || 0;

    // Get total local commits
    const totalOutput = await repo.raw(["rev-list", "--count", currentBranch]);
    const totalLocal = parseInt(totalOutput.trim()) || 0;

    res.json({
      success: true,
      ahead,
      behind,
      totalLocal,
      branch: currentBranch,
      needsPush: ahead > 0,
      needsPull: behind > 0,
    });
  } catch (err) {
    console.error(`[GitController] Get commit count failed:`, err);
    throw new AppError(`Failed to get commit count: ${err.message}`, 500);
  }
});

// ============================================================================
// HELPER: Get changed files (git status)
// ============================================================================

/**
 * GET /api/git/:projectId/status
 * Get current git status (changed files, staged files, etc)
 *
 * Returns:
 * {
 *   modified: ["src/file.js", "README.md"],
 *   staged: ["src/component.js"],
 *   untracked: ["node_modules/..."],
 *   deleted: [],
 *   renamed: [],
 *   conflicted: [],
 *   totalChanges: 5
 * }
 */
export const getGitStatus = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new AppError("Project not found", 404);
    }

    const repo = simpleGit(project.rootPath);
    const status = await repo.status();

    // Categorize files
    const categorized = {
      modified: status.files
        .filter((f) => f.working_dir === "M")
        .map((f) => f.path),
      staged: status.staged,
      untracked: status.not_added,
      deleted: status.files
        .filter((f) => f.working_dir === "D")
        .map((f) => f.path),
      renamed: status.renamed.map((r) => r.to),
      conflicted: status.conflicted,
    };

    res.json({
      success: true,
      ...categorized,
      totalChanges: Object.values(categorized).reduce(
        (sum, arr) => sum + arr.length,
        0,
      ),
      branch: project.currentBranch,
      hasChanges: status.files.length > 0 || status.staged.length > 0,
    });
  } catch (err) {
    console.error(`[GitController] Get git status failed:`, err);
    throw new AppError(`Failed to get status: ${err.message}`, 500);
  }
});
