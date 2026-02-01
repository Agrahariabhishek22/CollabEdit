// Git Routes (Stub for Day 2)
import express from "express";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

/**
 * @route   POST /api/git/clone
 * @desc    Clone a git repository
 * @access  Private
 */
router.post("/clone", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Clone repository - Coming soon",
  });
});

/**
 * @route   GET /api/git/branches/:projectId
 * @desc    Get all branches in a project
 * @access  Private
 */
router.get("/branches/:projectId", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Get branches - Coming soon",
    data: [],
  });
});

/**
 * @route   POST /api/git/checkout
 * @desc    Switch to a branch
 * @access  Private
 */
router.post("/checkout", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Checkout branch - Coming soon",
  });
});

/**
 * @route   POST /api/git/commit
 * @desc    Commit changes
 * @access  Private
 */
router.post("/commit", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Commit changes - Coming soon",
  });
});

export default router;
