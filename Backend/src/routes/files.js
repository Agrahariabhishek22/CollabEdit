import express from "express";
import { protect } from "../middlewares/auth.js"; // .js extension zaroori hai ESM mein
import {
  createFileOrFolder,
  renameFileOrFolder,
  deleteFileOrFolder,
} from "../controllers/fileController.js";

const router = express.Router();

// Protect all routes with authentication
// Note: 'protect' use kiya hai jo upar import hua hai
router.use(protect);

/**
 * POST /api/files/create
 * Create a new file or folder in an existing project
 */
router.post("/create", createFileOrFolder);

/**
 * PATCH /api/files/rename
 * Rename a file or folder
 */
router.patch("/rename", renameFileOrFolder);

/**
 * DELETE /api/files/delete
 * Soft-delete a file or folder
 */
router.delete("/delete", deleteFileOrFolder);

export default router;