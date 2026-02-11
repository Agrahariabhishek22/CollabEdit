/**
 * Git Controller: Clone, Branch Switch, & Repository Operations
 *
 * This controller implements the Hybrid Git Integration & Collaborative Workflow
 * as per the technical specifications.
 *
 * Key Features:
 * 1. Clone Repository with Partial Clone (--filter=blob:none)
 * 2. Directory Crawl with fs.promises.readdir() for async performance
 * 3. Branch Switching with Concurrent Lock Mechanism
 * 4. Skip Large Files (>10MB) & Binary Files with Notifications
 */

import { randomUUID } from "crypto";
import fs from "fs";
import path from "node:path";
import { simpleGit } from "simple-git";
import { asyncHandler, AppError } from "../middlewares/errorHandler.js";
import { prisma } from "../config/database.js";
import { getRedisClient } from "../config/redis.js";
import { getIO } from "../config/socketio.js";
import { fileURLToPath } from "url";
import { log } from "node:console";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const STORAGE_PATH =
  process.env.STORAGE_PATH || path.join(__dirname, "../../storage");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit for editor loading
const LOCK_TIMEOUT = 2 * 60 * 1000; // 2 minutes in ms

const BINARY_EXTENSIONS = [
  // Images
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".webp",
  ".ico",
  ".svg",
  // Archives
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".bz2",
  // Binaries
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  // Documents
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  // Media
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".wav",
  ".flac",
  // Other
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
];

const IGNORED_FOLDERS = [
  "node_modules",
  ".git",
  ".svn",
  "dist",
  "build",
  ".cache",
  ".next",
  "__pycache__",
  "vendor",
  "target",
  ".vs",
  ".idea",
  ".vscode",
  ".archived_storage",
  ".trash",
  "temp",
  "tmp",
  ".npm",
  ".yarn",
  ".hg",
];

const IGNORED_FILES = [".DS_Store", "thumbs.db", ".gitignore"];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a path should be ignored
 * WHY: Prevent system folders and caches from being synced to database
 */
const isIgnored = (itemPath, isFolder = false) => {
  const name = path.basename(itemPath);
  if (IGNORED_FILES.includes(name)) return true;
  if (isFolder && IGNORED_FOLDERS.includes(name)) return true;
  return false;
};

/**
 * Check if file is binary based on extension
 * WHY: Binary files (.png, .pdf, .exe) should NOT be read into EditorState
 * Prevents memory bloat and prevents corruption of binary content
 */
const isFileBinary = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.includes(ext);
};

/**
 * Get file statistics safely
 * WHY: Used to check file size before deciding whether to load content
 * Prevents server from trying to read 500MB files into memory
 */
const getFileStats = async (filePath) => {
  try {
    return await fs.promises.stat(filePath);
  } catch (err) {
    console.error(
      `[GitController] Error getting stats for ${filePath}:`,
      err.message,
    );
    return null;
  }
};

/**
 * Acquire branch lock for concurrent switch prevention
 * WHY: Prevent Race Condition - if 2 users switch branches simultaneously,
 * disk state could become inconsistent with DB state
 *
 * Returns: true if lock acquired, false if already locked
 */
export const acquireBranchLock = async (projectId) => {
  const io = getIO();
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (project.isBranchLocked) {
    const lockAge = Date.now() - new Date(project.lockAcquiredAt).getTime();

    // If lock is >2 min old, force unlock (dead session recovery)
    if (lockAge > LOCK_TIMEOUT) {
      console.warn(
        `[GitController] Forcing unlock on project ${projectId} (lock age: ${lockAge}ms)`,
      );
      await prisma.project.update({
        where: { id: projectId },
        data: { isBranchLocked: false, lockAcquiredAt: null },
      });
      return true;
    }

    return false;
  }

  // Acquire lock
  await prisma.project.update({
    where: { id: projectId },
    data: { isBranchLocked: true, lockAcquiredAt: new Date() },
  });

  return true;
};

/**
 * Release branch lock after switch completes
 * WHY: Allow next user to switch branches
 */
export const releaseBranchLock = async (projectId) => {
  const io = getIO();
  await prisma.project.update({
    where: { id: projectId },
    data: { isBranchLocked: false, lockAcquiredAt: null },
  });
};

// ============================================================================
// MAIN LOGIC: Directory Sync (Used during Clone & Branch Switch)
// ============================================================================

/**
 * Recursively crawl directory and sync to database
 *
 * WHY: After cloning repo to disk, need to create FileMeta + EditorState records
 * This function walks the directory tree and creates the database hierarchy
 *
 * Approach:
 * 1. Use fs.promises.readdir() for async/non-blocking I/O
 * 2. Check each item: ignore certain folders/files
 * 3. For folders: create FileMeta, then recurse
 * 4. For files: create FileMeta + EditorState, but skip large/binary files
 * 5. Create CollaboratorDetail for each file (permissions)
 *
 * @param {string} currentPath - Physical disk path to scan
 * @param {string} projectId - Database project ID
 * @param {string} userId - Creator/owner ID
 * @param {string|null} parentId - Parent FileMeta ID (for hierarchy)
 * @param {Object} tx - Prisma transaction (for atomic operations)
 * @param {Object} folderCache - Map to store pathSoFar -> metaId (for lookups)
 */
const syncDirectoryToDb = async (
  currentPath,
  projectId,
  userId,
  parentId = null,
  tx,
  folderCache,
) => {
  try {
    const io = getIO();
    // Async directory read (non-blocking)
    const items = await fs.promises.readdir(currentPath, {
      withFileTypes: true,
    });

    for (const item of items) {
      if (isIgnored(item.name, item.isDirectory())) continue;

      const fullPath = path.join(currentPath, item.name);
      const extension = item.isDirectory()
        ? null
        : path.extname(item.name).toLowerCase();
      const isBinary = !item.isDirectory() && isFileBinary(fullPath);

      let fileSize = null;
      let isLargeFile = false;
      let content = null;

      // For files: check size & read content
      // if (!item.isDirectory()) {
      //   const stats = await getFileStats(fullPath);
      //   if (stats) {
      //     fileSize = stats.size;
      //     isLargeFile = stats.size > MAX_FILE_SIZE;

      //     // WHY: Only read content if NOT binary AND NOT large
      //     // Prevents memory exhaustion and binary content corruption
      //     if (!isBinary && !isLargeFile) {
      //       try {
      //         content = await fs.promises.readFile(fullPath, "utf-8");
      //       } catch (err) {
      //         console.warn(
      //           `[GitController] Could not read file ${fullPath}: ${err.message}`,
      //         );
      //         content = null;
      //       }
      //     }
      //   }
      // }

      // Create FileMeta record
      const meta = await tx.fileMeta.create({
        data: {
          name: item.name,
          extension,
          isFolder: item.isDirectory(),
          projectId,
          parentId,
          absolutePath: fullPath,
          creatorId: userId,
          // isBinary,
          // isLargeFile,
          // fileSize,

          // // WHY: Create EditorState only if file has content
          // // If file is binary/large, EditorState.content remains NULL
          // ...(content && {
          //   editorState: {
          //     create: { content },
          //   },
          // }),
        },
      });

      // Create CollaboratorDetail (permissions)
      await tx.collaboratorDetail.create({
        data: {
          fileMetaId: meta.id,
          adminId: userId,
          editors: [],
          viewers: [],
        },
      });

      // Recurse into folders
      if (item.isDirectory()) {
        await syncDirectoryToDb(
          fullPath,
          projectId,
          userId,
          meta.id,
          tx,
          folderCache,
        );
      }
    }
  } catch (err) {
    console.error(
      `[GitController] Error syncing directory ${currentPath}:`,
      err.message,
    );
    throw err;
  }
};

// ============================================================================
// CONTROLLER: Clone Git Repository
// ============================================================================

/**
 * POST /api/git/clone
 * Clone a GitHub/GitLab repository and sync to database
 *
 * WHY: Enables users to collaborate on existing Git projects
 * Workflow:
 * 1. Validate Git URL & create Project record
 * 2. Clone with --filter=blob:none (partial clone for speed)
 * 3. Get default branch name
 * 4. Crawl directory tree with fs.promises.readdir()
 * 5. Create FileMeta + EditorState + CollaboratorDetail records (transactional)
 * 6. Return project ID & branch info to frontend
 */
export const cloneGitRepository = asyncHandler(async (req, res) => {
  const redis = getRedisClient();
  const io = getIO();

  const { repoUrl } = req.body;
  const userId = req.user.id;
  console.log("inside clonning a repo", repoUrl);

  if (!repoUrl) {
    throw new AppError("Repository URL is required", 400);
  }

  // Validate URL format
  if (!repoUrl.includes("github.com") && !repoUrl.includes("gitlab.com")) {
    throw new AppError("Only GitHub and GitLab URLs supported", 400);
  }

  try {
    // Extract repo name from URL (e.g., https://github.com/user/my-repo -> my-repo)
    const repoName = repoUrl.split("/").pop().replace(".git", "");
    const projectId = randomUUID() || `project-${Date.now()}`;
    const projectRoot = path.join(STORAGE_PATH, projectId);

    console.log(`[GitController] Cloning ${repoUrl} to ${projectRoot}`);

    // Ensure storage directory exists
    if (!fs.existsSync(STORAGE_PATH)) {
      fs.mkdirSync(STORAGE_PATH, { recursive: true });
    }

    // Create Project record first
    const project = await prisma.project.create({
      data: {
        id: projectId,
        name: repoName,
        sourceType: "GIT",
        remoteUrl: repoUrl,
        rootPath: projectRoot,
        ownerId: userId,
      },
    });

    console.log(`[GitController] Project created: ${project.id}`);

    // Clone repository with partial clone (--filter=blob:none)
    // WHY partial clone: Significantly reduces .git folder size
    // Objects (commits, trees) are downloaded, but file blobs are fetched on-demand
    // Makes clone ~50-70% faster for large repos
    const git = simpleGit();
    await git.clone(repoUrl, projectRoot, ["--filter=blob:none"]);

    console.log(`[GitController] Repository cloned to ${projectRoot}`);

    // Get default branch
    const repo = simpleGit(projectRoot);
    const branchSummary = await repo.branch();
    const defaultBranch = branchSummary.current || "main";

    console.log(`[GitController] Default branch: ${defaultBranch}`);

    // Update project with current branch
    // Ye entry project ke main folder ko represent karegi
    const rootFolderMeta = await prisma.fileMeta.create({
      data: {
        name: repoName, // Repository ka naam as folder name
        isFolder: true,
        projectId: projectId,
        absolutePath: projectRoot, // Pure project ki physical directory
        creatorId: userId,
      },
    });
    await prisma.collaboratorDetail.create({
      data: {
        fileMetaId: rootFolderMeta.id,
        adminId: userId,
      },
    });

    // 4. LINK ROOT TO PROJECT
    await prisma.project.update({
      where: { id: projectId },
      data: { rootFileMetaId: rootFolderMeta.id, currentBranch: defaultBranch },
    });

    // Sync directory to database (TRANSACTIONAL)
    // WHY: All-or-nothing operation - if any file fails, entire sync rolls back
    await prisma.$transaction(async (tx) => {
      await syncDirectoryToDb(
        projectRoot,
        projectId,
        userId,
        rootFolderMeta.id,
        tx,
        new Map(),
      );
    });

    console.log(`[GitController] Project ${projectId} fully synced`);

    res.status(201).json({
      success: true,
      message: "Repository cloned and synced successfully",
      projectId,
      branch: defaultBranch,
      name: repoName,
    });
  } catch (err) {
    console.error(`[GitController] Clone failed:`, err);

    // Rollback: delete project record
    try {
      await prisma.project.delete({ where: { id: projectId } });
    } catch (deleteErr) {
      console.error(`[GitController] Rollback failed:`, deleteErr.message);
    }
    // require

    throw new AppError(`Failed to clone repository: ${err.message}`, 500);
  }
});

// ============================================================================
// CONTROLLER: Switch Git Branch
// ============================================================================

/**
 * POST /api/git/:projectId/switch-branch
 * Switch to different branch and sync database
 *
 * WHY: Allow users to work on different branches collaboratively
 *
 * Workflow:
 * 1. Acquire branch lock (prevent concurrent switches)
 * 2. Broadcast "project-reloading" to all connected users
 * 3. Execute git checkout
 * 4. Crawl new branch structure
 * 5. Smart Sync:
 *    - Files that disappeared -> mark isDeleted: true (preserve history)
 *    - Files that appeared -> create new FileMeta
 *    - Files that stayed -> keep same ID, update content
 * 6. Update gitContext.currentBranch
 * 7. Clear Redis shadow docs
 * 8. Broadcast "project-reloaded" with updated file tree
 */
export const switchBranch = asyncHandler(async (req, res) => {
  const redis = getRedisClient();
  const io = getIO();
  const { projectId } = req.params;
  const { branchName } = req.body;
  const userId = req.user.id;

  if (!branchName) {
    throw new AppError("Branch name is required", 400);
  }

  try {
    // Step 1: Verify project exists and user has permission
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    const rootId = project?.rootFileMetaId;

    if (!project) {
      throw new AppError("Project not found", 404);
    }

    // Anyone can switch (as per user requirements, not just owner)
    // But we could add role-based check here if needed

    // Step 2: Acquire branch lock
    const lockAcquired = await acquireBranchLock(projectId);
    if (!lockAcquired) {
      throw new AppError(
        "Branch switch already in progress. Please wait and try again.",
        409,
      );
    }

    console.log(`[GitController] Branch lock acquired for ${projectId}`);

    // Step 3: Broadcast "project-reloading" to all connected users
    // WHY: Notify users that project structure is changing
    io.to(`project-${projectId}`).emit("project-reloading", {
      projectId,
      targetBranch: branchName,
      message: `Switching to branch: ${branchName}. Project is reloading...`,
    });

    console.log(
      `[GitController] Broadcast: project-reloading for ${projectId}`,
    );

    try {
      // Step 4: Execute git checkout
      const repo = simpleGit(project.rootPath);
      await repo.checkout(branchName);

      console.log(`[GitController] Checked out to branch: ${branchName}`);

      // Step 5: Get OLD structure (current DB state)
      const oldFiles = await prisma.fileMeta.findMany({
        where: {
          projectId,
          // isDeleted: false,
          id: {
            not: rootId,
          },
        },
        select: { id: true, absolutePath: true },
      });

      const oldFileMap = new Map(oldFiles.map((f) => [f.absolutePath, f]));

      // Step 6: Get NEW structure (crawl disk)
      // We'll create a new map of all files on disk
      const newFiles = new Set();

      const crawlNewStructure = async (currentPath) => {
        const items = await fs.promises.readdir(currentPath, {
          withFileTypes: true,
        });
        for (const item of items) {
          if (isIgnored(item.name, item.isDirectory())) continue;
          const fullPath = path.join(currentPath, item.name);
          newFiles.add(fullPath);
          if (item.isDirectory()) {
            await crawlNewStructure(fullPath);
          }
        }
      };

      await crawlNewStructure(project.rootPath);

      // console.log("Crawled Files:", Array.from(newFiles));

      console.log(
        `[GitController] New structure crawled: ${newFiles.size} items`,
      );

      // Step 7: Smart Sync Logic
      // Step 7: Smart Sync Logic
      await prisma.$transaction(async (tx) => {
        // 1. Purani files handle karo (Delete/Restore)
        for (const [oldPath, oldMeta] of oldFileMap) {
          const existsNow = newFiles.has(oldPath);
          await tx.fileMeta.update({
            where: { id: oldMeta.id },
            data: { isDeleted: !existsNow },
          });
          if (!existsNow)
            console.log(`[GitController] Marked ${oldPath} as deleted`);
        }

        // 2. Nayi files handle karo
        for (const newPath of newFiles) {
          if (!oldFileMap.has(newPath)) {
            // Parent path nikal lo (e.g., /a/b/c.txt -> /a/b)
            const parentPath = path.dirname(newPath);

            // Parent directory ka Meta ID dhundho DB mein
            const parentMeta = await tx.fileMeta.findFirst({
              where: {
                projectId,
                absolutePath: parentPath,
              },
            });

            // Agar parentMeta mil jata hai toh uska ID use karo,
            // warna project ka rootId default rakho
            const effectiveParentId = parentMeta ? parentMeta.id : rootId;

            console.log(
              `[GitController] Syncing new item: ${newPath} under parent: ${parentPath}`,
            );

            // syncDirectoryToDb call karo parent context ke sath
            await syncDirectoryToDb(
              parentPath, // New file path ka ek step up wala (Slashed path)
              project.id,
              userId,
              effectiveParentId, // Uss parent path ki Meta ID
              tx,
              new Map(),
            );

            // Note: loop break na ho jaye isliye logic handle karna padega
            // agar syncDirectoryToDb poori tree crawl kar raha hai.
          }
        }

        await prisma.project.update({
          where: { id: projectId },
          data: {
            currentBranch: branchName,
          },
        });
      });

      console.log(`[GitController] Database synced for branch ${branchName}`);

      // Step 8: Clear Redis shadow docs
      // WHY: Force re-hydration of Yjs docs when users open files
      // const shadowKey = `shadow:${projectId}`;
      // await redis.del(shadowKey);

      console.log(`[GitController] Redis shadow docs cleared`);

      // Step 9: Broadcast "project-reloaded"
      // const updatedFiles = await prisma.fileMeta.findMany({
      //   where: { projectId, isDeleted: false },
      //   select: { id: true, name: true, absolutePath: true, isFolder: true },
      // });

      io.to(`project-${projectId}`).emit("project-reloaded", {
        projectId,
        branch: branchName,
        // files: updatedFiles,
        message: `Successfully switched to ${branchName}`,
      });

      console.log(`[GitController] Broadcast: project-reloaded`);

      res.json({
        success: true,
        message: `Switched to branch: ${branchName}`,
        projectId,
        branch: branchName,
      });
    } catch (err) {
      console.error(`[GitController] Branch switch error:`, err);
      throw err;
    } finally {
      // Always release lock
      await releaseBranchLock(projectId);
      console.log(`[GitController] Branch lock released for ${projectId}`);
    }
  } catch (err) {
    throw new AppError(`Branch switch failed: ${err.message}`, 500);
  }
});

// ============================================================================
// CONTROLLER: Get Available Branches
// ============================================================================

/**
 * GET /api/git/:fileMetaId/branches
 * Fetch list of all branches from repository
 */
export const getBranches = asyncHandler(async (req, res) => {
  const { projectId } = req.params; // ✅ Ab ye asli projectId hai

  try {
    // 1. Seedha Project fetch karo database se
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    // Error handling agar project na mile
    if (!project) {
      throw new AppError(
        "Bhai, ye Project ID database mein exist nahi karti!",
        404,
      );
    }

    const repo = simpleGit(project.rootPath);
    const branchSummary = await repo.branch(["-a"]);
    const activeBranch = branchSummary.current;

    // 1. Set use karo unique names ke liye
    const uniqueNames = new Set();

    branchSummary.all.forEach((rawName) => {
      // Naam saaf karo (prefix hatao)
      const cleanName = rawName
        .replace("remotes/origin/", "")
        .replace("remotes/", "");
      uniqueNames.add(cleanName);
    });

    // 2. Ab is Set se final array banao
    const finalBranches = Array.from(uniqueNames).map((name) => {
      return {
        name: name,
        isCurrent: name === activeBranch,
        // Hum hamesha local ki tarah treat karenge kyunki checkout pe ye local ban jayegi
        isRemote: false,
      };
    });

    console.log(finalBranches);

    res.json({
      success: true,
      currentBranch: project.currentBranch,
      gitCurrentBranch: activeBranch,
      branches: finalBranches,
    });
  } catch (err) {
    console.error(`[Git Error] fetch remote branches failed: ${err.message}`);
    throw new AppError(`Failed to fetch remote branches: ${err.message}`, 500);
  }
});
