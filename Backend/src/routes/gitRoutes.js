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

const router = express.Router();

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

// TODO: More routes in Phase 2
// - router.get("/:projectId/commits", authenticate, getCommits);
// - router.get("/:projectId/diff/:filePath", authenticate, getDiff);
// - router.post("/:projectId/commit", authenticate, createCommit);

export default router;
