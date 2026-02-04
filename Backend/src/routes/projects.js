// Projects Routes (Stub for Day 2)
import express from "express";
import { protect } from "../middlewares/auth.js";
import { createAndUploadProject } from "../controllers/projectController.js";
import { upload } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

/**
 * @route   GET /api/projects
 * @desc    Get all projects for user
 * @access  Private
 */
router.get("/", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Get all projects - Coming soon",
    data: [],
  });
});

/**
 * @route   POST /api/projects
 * @desc    Create a new project
 * @access  Private
 */
router.post("/upload", protect,upload.array('files',1000), createAndUploadProject)

/**
 * @route   GET /api/projects/:projectId
 * @desc    Get project by ID
 * @access  Private
 */
router.get("/:projectId", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Get project by ID - Coming soon",
  });
});

/**
 * @route   POST /api/projects/:projectId/join
 * @desc    Join a collaborative session
 * @access  Private
 */
router.post("/:projectId/join", protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Join project - Coming soon",
  });
});

export default router;
