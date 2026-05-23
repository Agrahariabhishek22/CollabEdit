// src/socket/handlers/conflict.handler.js

/**
 * ConflictHandler
 *
 * Socket event handler for conflict-related events:
 * - conflict:detect     (triggered after Yjs update)
 * - conflict:resolve    (user resolves a conflict)
 * - conflict:list       (fetch all conflicts for file)
 *
 * CALLED BY:
 * - io.on("connection") in server.js
 *
 * INITIALIZATION:
 * conflictHandler.register(socket);
 */

import ConflictMarkerManager from "../../services/conflict/ConflictMarkerManager.js";

class ConflictHandler {
  constructor(io, conflictDetector, conflictResolver, markerManager) {
    this.io = io;
    this.conflictDetector = conflictDetector;
    this.conflictResolver = conflictResolver;
    this.markerManager = markerManager; // 👈 ADD THIS
  }

  /**
   * Register all socket event listeners
   */
  register(socket) {
    // Event: User requests conflict list for file
    socket.on("conflict:list", async (data) => {
      await this._handleListConflicts(socket, data);
    });

    // Event: User resolves a conflict
    socket.on("conflict:resolve", async (data) => {
      await this._handleResolveConflict(socket, data);
    });

    // Event: User dismisses a conflict modal
    socket.on("conflict:dismiss", async (data) => {
      await this._handleDismissConflict(socket, data);
    });

    console.log(`[ConflictHandler] Events registered for socket ${socket.id}`);
  }

  /**
   * INTERNAL: Called by YjsHandler after Yjs update
   * Runs conflict detection and broadcasts to affected user
   */
  async detectAndBroadcast(params) {
    const { fileId, code, language, userId, socket } = params;

    try {
      console.error(
        "[ConflictHandler] Starting Conflict detecttion and broadcasting :",
        params.fileId,
        params.userId,
      );

      // Run conflict detection
      const conflicts = await this.conflictDetector.analyze({
        fileId,
        code,
        language,
        userId,
      });

      if (conflicts.length === 0) {
        console.log(`[ConflictHandler] No conflicts detected in ${fileId}`);
        return { success: true, conflicts: [] };
      }

      // Store conflicts in Redis
      const stored = await this.conflictDetector.storeConflicts(
        fileId,
        conflicts,
      );

      if (!stored) {
        console.error("[ConflictHandler] Failed to store conflicts in Redis");
        return { success: false, error: "Storage failed" };
      }

      // ════════════════════════════════════════════════════════════
      // 🔴 INSERT CONFLICT MARKERS IN YJS
      // ════════════════════════════════════════════════════════════

      for (const conflict of conflicts) {
        // Insert marker in Yjs
        const markerInserted = await this.markerManager.insertMarker(
          fileId,
          conflict,
        );

        if (!markerInserted) {
          console.warn(
            `[ConflictHandler] Failed to insert marker for ${conflict.id}`,
          );
        }
      }

      // Wait thoda (Yjs update process ke liye)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // ════════════════════════════════════════════════════════════
      // Broadcast to affected user
      // ════════════════════════════════════════════════════════════

      for (const conflict of conflicts) {
        // Send to specific user (affected by conflict)
        socket.emit("conflict:detected", {
          fileId, // ✅ ADD-ON: Include fileId
          conflictId: conflict.id,
          type: conflict.type,
          severity: conflict.severity,
          symbol: conflict.symbol,
          relatedSymbols: conflict.relatedSymbols || [], // ✅ ADD-ON
          message: this._generateUserMessage(conflict),
          suggestedFix: conflict.suggestedFix,
          location: conflict.location,
        });

        // Log for debugging
        console.log(
          `[ConflictHandler] Sent conflict notification to user ${userId}: ${conflict.type}`,
        );
      }

      return { success: true, conflicts };
    } catch (err) {
      console.error("[ConflictHandler] Detection and broadcast error:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * EVENT HANDLER: conflict:list
   * User requests all conflicts for a file
   */
  async _handleListConflicts(socket, { fileId }) {
    try {
      if (!fileId) {
        socket.emit("conflict:list-error", { error: "fileId required" });
        return;
      }

      const conflicts = await this.conflictDetector.getConflicts(fileId);

      socket.emit("conflict:list", {
        fileId,
        conflicts: conflicts.map((c) => ({
          id: c.id,
          type: c.type,
          severity: c.severity,
          symbol: c.symbol,
          status: c.metadata.status,
          message: this._generateUserMessage(c),
        })),
      });

      console.log(
        `[ConflictHandler] Listed ${conflicts.length} conflicts for ${fileId}`,
      );
    } catch (err) {
      console.error("[ConflictHandler] List conflicts error:", err);
      socket.emit("conflict:list-error", { error: err.message });
    }
  }

  /**
   * EVENT HANDLER: conflict:resolve
   * User resolves a conflict (rename, revert, etc.)
   */
  async _handleResolveConflict(socket, params) {
    const { conflictId, fileId, resolution, data } = params;
    const { userId } = socket;

    try {
      if (!conflictId || !fileId || !resolution) {
        socket.emit("conflict:resolve-error", {
          error: "conflictId, fileId, resolution required",
        });
        return;
      }

      console.log(
        `[ConflictHandler] User ${userId} resolving conflict ${conflictId} via ${resolution}`,
      );

      // Call ConflictResolver
      const result = await this.conflictResolver.resolve({
        conflictId,
        fileId,
        resolution,
        data,
        userId,
      });

      if (!result.success) {
        socket.emit("conflict:resolve-error", { error: result.error });
        return;
      }

      // Send confirmation to user
      socket.emit("conflict:resolved", {
        conflictId,
        fileId,
        resolution,
        timestamp: Date.now(),
      });

      // Note: Full broadcast happens in ConflictResolver.resolve()

      console.log(
        `[ConflictHandler] Conflict ${conflictId} resolved successfully`,
      );
    } catch (err) {
      console.error("[ConflictHandler] Resolve conflict error:", err);
      socket.emit("conflict:resolve-error", { error: err.message });
    }
  }

  /**
   * EVENT HANDLER: conflict:dismiss
   * User dismisses conflict modal (but conflict stays)
   * Just a UI action, no backend change needed
   */
  async _handleDismissConflict(socket, { conflictId, fileId }) {
    try {
      console.log(
        `[ConflictHandler] User ${socket.userId} dismissed conflict ${conflictId}`,
      );

      // Broadcast dismissal to all users in file
      // this.io.to(`file:${fileId}`).emit("conflict:dismissed", {
      //   conflictId,
      //   fileId, // ✅ ADD-ON: Include fileId
      // });
      socket.emit("conflict:dismissed", { conflictId });
      console.log(
        `[ConflictHandler] Dismissed conflict broadcasted: ${conflictId}`,
      );
    } catch (err) {
      console.error("[ConflictHandler] Dismiss conflict error:", err);
    }
  }

  /**
   * Generate user-friendly message for conflict
   */
  _generateUserMessage(conflict) {
    const { type, symbol, severity } = conflict;

    const messages = {
      "duplicate-declaration": `Naming Conflict: '${symbol}' is already declared in this scope.`,
      "function-signature-drift": `Function '${symbol}' signature has changed. Call sites may break.`,
      "const-mutation": `Const Mutation: '${symbol}' is declared as const and cannot be reassigned.`,
      "exported-api-contract": `API Change: Exported '${symbol}' signature has changed.`,
      shadowing: `Variable Shadowing: '${symbol}' shadows an outer scope variable.`,
      "unresolved-identifier": `Undefined Variable: '${symbol}' is not defined in this file.`,
    };

    const message = messages[type] || `${type}: ${symbol}`;

    if (severity === "blocking") {
      return `🔴 ${message}`;
    } else {
      return `🟡 ${message}`;
    }
  }
}

export default ConflictHandler;
