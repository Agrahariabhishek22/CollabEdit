// src/services/yjs/YjsPersistence.js

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * YjsPersistence
 * 
 * PURPOSE: Handle all disk read/write operations for Yjs documents
 * 
 * RESPONSIBILITIES:
 * 1. Load raw text from disk (app.js)
 * 2. Load Yjs binary from disk (.app.js.yjs)
 * 3. Save both raw text and binary to disk
 * 4. Handle checkpoint files
 * 
 * WORKFLOW:
 * - On file open: loadBinaryFromDisk() or loadRawTextFromDisk()
 * - On flush: saveToDisk() writes both files
 * - On checkpoint: saveCheckpoint() to .checkpoints/ folder
 */

class YjsPersistence {
  constructor(prisma) {
    this.prisma = prisma;
  }

  // ═══════════════════════════════════════════════════════════
  // LOAD RAW TEXT FROM DISK (Fallback when no .yjs file)
  // ═══════════════════════════════════════════════════════════

  /**
   * Load raw text from physical file (e.g., app.js)
   * Used when .yjs binary doesn't exist (first time opening file)
   */
  async loadRawTextFromDisk(fileId) {
    try {
      // Get file metadata from DB
      const file = await this.prisma.fileMeta.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new Error(`File ${fileId} not found in database`);
      }

      const { absolutePath } = file;

      // Check if file exists
      try {
        await fs.access(absolutePath);
      } catch (err) {
        console.warn(`[YjsPersistence] File not found: ${absolutePath}`);
        return null;
      }

      // Read file content
      const content = await fs.readFile(absolutePath, "utf-8");
      
      console.log(`[YjsPersistence] Loaded raw text from ${absolutePath} (${content.length} chars)`);
      
      return content;

    } catch (err) {
      console.error(`[YjsPersistence] Error loading raw text for ${fileId}:`, err);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // LOAD YJS BINARY FROM DISK (.yjs file)
  // ═══════════════════════════════════════════════════════════

  /**
   * Load Yjs binary state from .yjs file
   * Faster than parsing raw text + maintains undo/redo history
   */
  async loadBinaryFromDisk(fileId) {
    try {
      // Get file metadata from DB
      const file = await this.prisma.fileMeta.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new Error(`File ${fileId} not found in database`);
      }

      const { absolutePath } = file;
      const binaryPath = `${absolutePath}.yjs`;

      // Check if .yjs file exists
      try {
        await fs.access(binaryPath);
      } catch (err) {
        console.log(`[YjsPersistence] No .yjs file found: ${binaryPath}`);
        return null;
      }

      // Read binary file
      const binary = await fs.readFile(binaryPath);
      
      console.log(`[YjsPersistence] Loaded binary from ${binaryPath} (${binary.length} bytes)`);
      
      return binary;

    } catch (err) {
      console.error(`[YjsPersistence] Error loading binary for ${fileId}:`, err);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SAVE TO DISK (Both raw text + binary)
  // ═══════════════════════════════════════════════════════════

  /**
   * Save both raw text and Yjs binary to disk
   * Called by FlushScheduler and on manual save
   * 
   * @param {string} fileId - File ID
   * @param {string} rawText - Plain text content (for Git sync)
   * @param {Uint8Array} binary - Yjs binary state (for fast reload)
   */
  async saveToDisk(fileId, rawText, binary) {
    try {
      // Get file metadata from DB
      const file = await this.prisma.fileMeta.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new Error(`File ${fileId} not found in database`);
      }

      const { absolutePath } = file;
      const binaryPath = `${absolutePath}.yjs`;

      // Ensure parent directory exists
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });

      // Write raw text file (for Git, human-readable)
      await fs.writeFile(absolutePath, rawText, "utf-8");
      
      // Write binary file (for fast reload, undo/redo)
      await fs.writeFile(binaryPath, Buffer.from(binary));

      console.log(`[YjsPersistence] Saved ${fileId} to disk:`);
      console.log(`  - Raw: ${absolutePath} (${rawText.length} chars)`);
      console.log(`  - Binary: ${binaryPath} (${binary.length} bytes)`);

      return { success: true, absolutePath, binaryPath };

    } catch (err) {
      console.error(`[YjsPersistence] Error saving ${fileId} to disk:`, err);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SAVE CHECKPOINT (To .checkpoints folder)
  // ═══════════════════════════════════════════════════════════

  /**
   * Save checkpoint to disk
   * Each user gets 1 checkpoint slot per file
   * 
   * @param {string} projectId - Project ID
   * @param {string} userId - User ID
   * @param {string} fileName - File name (e.g., app.js)
   * @param {string} rawText - File content
   * @param {Uint8Array} binary - Yjs state
   */
  async saveCheckpoint(projectId, userId, fileName, rawText, binary) {
    try {
      // Get project root path
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        throw new Error(`Project ${projectId} not found`);
      }

      const checkpointsDir = path.join(project.rootPath, ".checkpoints");
      
      // Ensure .checkpoints directory exists
      await fs.mkdir(checkpointsDir, { recursive: true });

      // Checkpoint filenames
      const checkpointName = `${userId}_${fileName}.checkpoint`;
      const binaryName = `${userId}_${fileName}.yjs.checkpoint`;

      const checkpointPath = path.join(checkpointsDir, checkpointName);
      const binaryCheckpointPath = path.join(checkpointsDir, binaryName);

      // Write checkpoint files
      await fs.writeFile(checkpointPath, rawText, "utf-8");
      await fs.writeFile(binaryCheckpointPath, Buffer.from(binary));

      console.log(`[YjsPersistence] Saved checkpoint for user ${userId}:`);
      console.log(`  - Raw: ${checkpointPath}`);
      console.log(`  - Binary: ${binaryCheckpointPath}`);

      return {
        checkpointPath,
        binaryCheckpointPath,
      };

    } catch (err) {
      console.error(`[YjsPersistence] Error saving checkpoint:`, err);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // LOAD CHECKPOINT (From .checkpoints folder)
  // ═══════════════════════════════════════════════════════════

  /**
   * Load checkpoint from disk
   * 
   * @param {string} checkpointPath - Path to checkpoint file
   */
  async loadCheckpoint(checkpointPath) {
    try {
      // Check if checkpoint exists
      await fs.access(checkpointPath);

      // Derive binary path
      const binaryPath = checkpointPath.replace('.checkpoint', '.yjs.checkpoint');

      // Read files
      const rawText = await fs.readFile(checkpointPath, "utf-8");
      const binary = await fs.readFile(binaryPath);

      console.log(`[YjsPersistence] Loaded checkpoint: ${checkpointPath}`);

      return {
        rawText,
        binary,
      };

    } catch (err) {
      console.error(`[YjsPersistence] Error loading checkpoint:`, err);
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // DELETE FILE FROM DISK
  // ═══════════════════════════════════════════════════════════

  /**
   * Delete file and its .yjs counterpart
   * Used when user deletes file
   */
  async deleteFromDisk(fileId) {
    try {
      const file = await this.prisma.fileMeta.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new Error(`File ${fileId} not found`);
      }

      const { absolutePath } = file;
      const binaryPath = `${absolutePath}.yjs`;

      // Delete raw file
      try {
        await fs.unlink(absolutePath);
        console.log(`[YjsPersistence] Deleted: ${absolutePath}`);
      } catch (err) {
        console.warn(`[YjsPersistence] Could not delete ${absolutePath}:`, err.message);
      }

      // Delete binary file
      try {
        await fs.unlink(binaryPath);
        console.log(`[YjsPersistence] Deleted: ${binaryPath}`);
      } catch (err) {
        console.warn(`[YjsPersistence] Could not delete ${binaryPath}:`, err.message);
      }

      return { success: true };

    } catch (err) {
      console.error(`[YjsPersistence] Error deleting file:`, err);
      throw err;
    }
  }
}

export default YjsPersistence;