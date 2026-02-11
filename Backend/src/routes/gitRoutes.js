/**
 * Git Routes
 * 
 * Endpoints for Git operations:
 * - Clone repository
 * - Switch branches
 * - View branches
 * - Get commit history
 * - View diffs
 * 
 * All routes require authentication
 */

import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  cloneGitRepository,
  switchBranch,
  getBranches,
  // TODO: getCommits, getDiff, createCommit (Phase 2)
} from "../controllers/gitController.js";
import { commitChanges, createBranch, getCommitCount, getCommitDiff, getCommitHistory, getGitStatus, pushBranch } from "../controllers/gitOperationController.js";

const router = express.Router();
router.use(protect)

// ============================================================================
// CLONE REPOSITORY
// ============================================================================

/**
 * POST /api/git/clone
 * Clone a GitHub/GitLab repository
 * 
 * Request Body:
 * {
 *   "repoUrl": "https://github.com/user/repo"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "projectId": "uuid",
 *   "branch": "main",
 *   "name": "repo-name"
 * }
 */
router.post("/clone", protect, cloneGitRepository);

// ============================================================================
// BRANCH OPERATIONS
// ============================================================================

/**
 * GET /api/git/:projectId/branches
 * Get list of all branches
 * 
 * Query Params: (none)
 * 
 * Response:
 * {
 *   "success": true,
 *   "currentBranch": "main",
 *   "branches": [
 *     { "name": "main", "isCurrent": true, "isRemote": false },
 *     { "name": "feature-x", "isCurrent": false, "isRemote": false }
 *   ]
 * }
 */
router.get("/:projectId/branches", protect, getBranches);

/**
 * POST /api/git/:projectId/switch-branch
 * Switch to a different branch
 * 
 * Request Body:
 * {
 *   "branchName": "feature-login"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Switched to branch: feature-login",
 *   "projectId": "uuid",
 *   "branch": "feature-login"
 * }
 * 
 * Error Cases:
 * - 409: Branch switch already in progress (locked)
 * - 404: Project not found
 * - 500: Git error
 */
router.post("/:projectId/switch-branch", protect, switchBranch);


// ============================================================================
// BRANCH OPERATIONS
// ============================================================================

/**
 * POST /api/git/:projectId/create-branch
 * Create a new branch
 *
 * Body:
 * {
 *   branchName: "feat-new-feature",
 *   sourceBranch: "main" // optional
 * }
 */
router.post("/:projectId/create-branch", createBranch);

// ============================================================================
// PUSH OPERATIONS
// ============================================================================

/**
 * POST /api/git/:projectId/push
 * Push current branch to remote
 *
 * Body:
 * {
 *   branch: "feat-new-feature", // optional, uses current if not provided
 *   force: false // optional, dangerous!
 * }
 */
router.post("/:projectId/push", pushBranch);

// ============================================================================
// COMMIT OPERATIONS
// ============================================================================

/**
 * GET /api/git/:projectId/commits
 * Get commit history
 *
 * Query:
 * ?limit=50&offset=0&branch=main
 */
router.get("/:projectId/commits", getCommitHistory);

/**
 * GET /api/git/:projectId/commits/:commitHash/diff
 * Get diff for specific commit
 */
router.get("/:projectId/commits/:commitHash/diff", getCommitDiff);



// COMMIT OPERATIONS 

/**
 * POST /api/git/:projectId/commit
 * Commit changes with proper attribution
 *
 * Body:
 * {
 *   message: "feat: add new feature",
 *   description: "Optional longer description\nWith multiple lines" // optional
 * }
 */
router.post("/:projectId/commit", commitChanges);

/**
 * GET /api/git/:projectId/status
 * Get current git status
 *
 * Returns files that are modified, staged, untracked, etc
 */
router.get("/:projectId/status", getGitStatus);

/**
 * GET /api/git/:projectId/commit-count
 * Get commits ahead/behind remote
 */
router.get("/:projectId/commit-count", getCommitCount);


export default router;
