// Files Routes (Stub for Day 2)
import express from "express";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

/**
 * @route   GET /api/files/:projectId
 * @desc    Get all files in a project
 * @access  Private
 */
router.get("/:projectId", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Get files - Coming soon",
    data: [],
  });
});

/**
 * @route   POST /api/files/open
 * @desc    Open a file for editing
 * @access  Private
 */
router.post("/open", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Open file - Coming soon",
  });
});

/**
 * @route   POST /api/files/close
 * @desc    Close a file
 * @access  Private
 */
router.post("/close", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Close file - Coming soon",
  });
});

export default router;
