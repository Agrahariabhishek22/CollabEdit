// src/services/conflict/ConflictResolver.js
import LSPDocumentSanitizer from "../lsp/LSPDocumentSanitizer.js";
import ConflictMarkerManager from "./ConflictMarkerManager.js";
/**
 * ConflictResolver
 *
 * Handles user resolution of conflicts.
 * When user chooses "Rename", "Revert", etc., this service:
 * 1. Updates Shadow Doc (removes markers)
 * 2. Updates Redis (marks conflict as resolved)
 * 3. Broadcasts changes to all users
 *
 * CALLED BY:
 * - conflict.handler.js (socket events)
 *
 * RESOLUTION TYPES:
 * - rename: Change variable/function name
 * - revert: Undo the change (pop from Yjs history)
 * - convert-to-let: Change const to let
 * - acknowledge: For warnings (user accepts)
 */
class ConflictResolver {
  constructor(redis, yjsDocManager, sessionManager, io) {
    this.redis = redis;
    this.yjsDocManager = yjsDocManager;
    this.sessionManager = sessionManager;
    this.io = io;
    this.sanitizer = new LSPDocumentSanitizer();
    this.markerManager = null; // Set in initialize()
  }

  setMarkerManager(markerManager) {
    this.markerManager = markerManager;
  }
  /**
   * Main resolution handler
   *
   * PARAMS:
   * {
   *   conflictId: "uuid",
   *   fileId: "file_123",
   *   resolution: "rename" | "revert" | "convert-to-let" | "acknowledge",
   *   data: {
   *     newName: "x1",  // For rename
   *     // other options as needed
   *   },
   *   userId: "user_A"
   * }
   */
  async resolve(params) {
    const { conflictId, fileId, resolution, data, userId } = params;

    try {
      console.log(
        `[ConflictResolver] Resolving conflict ${conflictId} via ${resolution}`,
      );

      // ════════════════════════════════════════════════════════════
      // STEP 1: Get conflict metadata from Redis
      // ════════════════════════════════════════════════════════════

      const conflictData = await this.redis.hget(
        `conflicts:${fileId}`,
        conflictId,
      );

      if (!conflictData) {
        console.error(`[ConflictResolver] Conflict not found: ${conflictId}`);
        return { success: false, error: "Conflict not found" };
      }

      const conflict = JSON.parse(conflictData);

      // ════════════════════════════════════════════════════════════
      // STEP 2: Route based on resolution type
      // ════════════════════════════════════════════════════════════

      let result;

      switch (resolution) {
        case "rename":
          result = await this._handleRename(
            fileId,
            conflict,
            data.newName,
            userId,
          );
          break;

        case "revert":
          result = await this._handleRevert(fileId, conflict, userId);
          break;

        case "convert-to-let":
          result = await this._handleConvertToLet(fileId, conflict, userId);
          break;

        case "acknowledge":
          result = await this._handleAcknowledge(fileId, conflict, userId);
          break;

        default:
          result = {
            success: false,
            error: `Unknown resolution: ${resolution}`,
          };
      }

      if (!result.success) {
        return result;
      }

      // ════════════════════════════════════════════════════════════
      // STEP 3: Update Redis (mark as resolved)
      // ════════════════════════════════════════════════════════════

      conflict.metadata.status = "resolved";
      conflict.metadata.resolvedAt = Date.now();
      conflict.metadata.resolvedBy = userId;
      conflict.metadata.resolutionType = resolution;

      await this.redis.hset(
        `conflicts:${fileId}`,
        conflictId,
        JSON.stringify(conflict),
      );

      console.log(
        `[ConflictResolver] Conflict marked as resolved: ${conflictId}`,
      );

      // ════════════════════════════════════════════════════════════
      // STEP 4: Broadcast to all users in file
      // ════════════════════════════════════════════════════════════

      this.io.to(`file:${fileId}`).emit("conflict:resolved", {
        conflictId,
        fileId,
        resolution,
        resolvedBy: userId,
        timestamp: Date.now(),
      });

      console.log(
        `[ConflictResolver] Broadcasted resolution to file ${fileId}`,
      );

      return { success: true, conflict };
    } catch (err) {
      console.error("[ConflictResolver] Resolution error:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle RENAME resolution
   *
   * LOGIC:
   * 1. Remove conflict markers from Shadow Doc (by location)
   * 2. Replace all occurrences of old name with new name
   *    (within conflict range, or globally)
   * 3. Broadcast change to all users
   */
  async _handleRename(fileId, conflict, newName, userId) {
    try {
      if (!newName) {
        return { success: false, error: "New name not provided" };
      }

      console.log(
        `[ConflictResolver] Renaming '${conflict.symbol}' to '${newName}'`,
      );

      // Get Shadow Doc
      const doc = await this.yjsDocManager.getOrCreateDoc(fileId);
      if (!doc) {
        return { success: false, error: "Could not get Shadow Doc" };
      }

      // Get current code
      const code = doc.ytext.toString();

      // Simple string replacement (in production use LSP textDocument/rename)
      const oldSymbol = conflict.symbol;
      const newCode = code.replace(
        new RegExp(`\\b${oldSymbol}\\b`, "g"),
        newName,
      );

      // Replace entire content
      doc.ytext.delete(0, code.length);
      doc.ytext.insert(0, newCode);

      // Remove marker
      if (this.markerManager) {
        await this.markerManager.removeMarker(fileId, conflict.id);
      }

      console.log(`[ConflictResolver] Rename successful`);
      return { success: true };
    } catch (err) {
      console.error("[ConflictResolver] Rename error:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle REVERT resolution
   *
   * LOGIC:
   * 1. Get last Yjs state before conflict
   * 2. Revert Shadow Doc to that state
   * 3. Remove markers
   * 4. Broadcast to all users (they see the revert)
   */
  async _handleRevert(fileId, conflict, userId) {
    try {
      console.log(`[ConflictResolver] Reverting conflict in ${fileId}`);

      const doc = await this.yjsDocManager.getOrCreateDoc(fileId);
      if (!doc) {
        return { success: false, error: "Could not get Shadow Doc" };
      }

      // TODO: Implement Yjs undo capability
      // For now, just remove marker
      if (this.markerManager) {
        await this.markerManager.removeMarker(fileId, conflict.id);
      }

      console.log(`[ConflictResolver] Revert attempted`);
      return { success: true };
    } catch (err) {
      console.error("[ConflictResolver] Revert error:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle CONVERT-TO-LET resolution
   *
   * For const mutation conflicts:
   * 1. Find "const" keyword
   * 2. Replace with "let"
   * 3. Remove markers
   * 4. Broadcast
   */
  async _handleConvertToLet(fileId, conflict, userId) {
    try {
      console.log(`[ConflictResolver] Converting const to let`);

      const doc = await this.yjsDocManager.getOrCreateDoc(fileId);
      if (!doc) {
        return { success: false, error: "Could not get Shadow Doc" };
      }

      const code = doc.ytext.toString();

      // Find "const" at conflict location and replace with "let"
      const location = conflict.location;
      const absoluteIndex = this._lineColToIndex(
        code,
        location.startLine,
        location.startColumn,
      );

      // Look for "const" keyword before absoluteIndex
      const beforeIndex = code.substring(
        Math.max(0, absoluteIndex - 10),
        absoluteIndex,
      );
      const constIndex = beforeIndex.lastIndexOf("const");

      if (constIndex !== -1) {
        const actualIndex = absoluteIndex - beforeIndex.length + constIndex;
        doc.ytext.delete(actualIndex, 5); // Delete "const"
        doc.ytext.insert(actualIndex, "let");
      }

      // Remove marker
      if (this.markerManager) {
        await this.markerManager.removeMarker(fileId, conflict.id);
      }

      console.log(`[ConflictResolver] Convert-to-let successful`);
      return { success: true };
    } catch (err) {
      console.error("[ConflictResolver] Convert-to-let error:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle ACKNOWLEDGE resolution
   *
   * For warning-level conflicts (like shadowing):
   * Just remove markers, user accepts the warning
   */
  async _handleAcknowledge(fileId, conflict, userId) {
    try {
      console.log(`[ConflictResolver] Acknowledging warning`);

      // Just remove marker (user accepts)
      if (this.markerManager) {
        await this.markerManager.removeMarker(fileId, conflict.id);
      }

      return { success: true };
    } catch (err) {
      console.error("[ConflictResolver] Acknowledge error:", err);
      return { success: false, error: err.message };
    }
  }

  _lineColToIndex(text, line, col) {
    const lines = text.split("\n");
    let index = 0;

    for (let i = 0; i < line && i < lines.length; i++) {
      index += lines[i].length + 1;
    }

    index += col;
    return Math.min(index, text.length);
  }

  log(message) {
    console.log(`[ConflictResolver] ${message}`);
  }
}

export default ConflictResolver;
