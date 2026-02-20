// socket/handlers/yjs.handler.js
import ConflictHandler from "./conflict.handler.js";

class YjsHandler {
  constructor(
    io,
    yjsDocManager,
    permissionValidator,
    sessionManager,
    redis,
    conflictHandler,
  ) {
    this.io = io;
    this.yjsDocManager = yjsDocManager;
    this.permissionValidator = permissionValidator;
    this.sessionManager = sessionManager;
    this.redis = redis;
    this.conflictHandler = conflictHandler;

    // Debounce timers for flush
    this.flushTimers = new Map();
  }

  register(socket) {
    // ═══════════════════════════════════════════════════════════
    // REQUEST INITIAL STATE
    // ═══════════════════════════════════════════════════════════

    socket.on("yjs:request-state", async ({ fileId }) => {
      await this.handleRequestState(socket, fileId);
    });

    // ═══════════════════════════════════════════════════════════
    // SEND UPDATE (User types)
    // ═══════════════════════════════════════════════════════════

    socket.on("yjs:update", async ({ fileId, update }) => {
      await this.handleUpdate(socket, fileId, update);
    });

    // ═══════════════════════════════════════════════════════════
    // AWARENESS (Cursor position)
    // ═══════════════════════════════════════════════════════════

    socket.on("yjs:awareness", async ({ fileId, state }) => {
      await this.handleAwareness(socket, fileId, state);
    });
  }

  // ═══════════════════════════════════════════════════════════
  // REQUEST STATE (Initial load)
  // ═══════════════════════════════════════════════════════════

  async handleRequestState(socket, fileId) {
    const { userId } = socket;

    try {
      // Validate READ access
      const validation = await this.permissionValidator.validateAction(
        userId,
        fileId,
        "READ",
      );

      if (!validation.allowed) {
        return socket.emit("yjs:error", {
          fileId,
          message: "Access denied",
        });
      }

      // Get or create Shadow Y.Doc
      const docData = await this.yjsDocManager.getOrCreateDoc(fileId);

      // Add user to doc's user set
      this.yjsDocManager.addUser(fileId, userId);

      // Send full state to user
      const stateVector = await this.yjsDocManager.getStateVector(fileId);

      socket.emit("yjs:state", {
        fileId,
        state: Array.from(stateVector), // Convert Uint8Array to array
        timestamp: Date.now(),
      });

      console.log(
        `[Yjs] Sent initial state to ${socket.userName} for ${fileId}`,
      );
    } catch (err) {
      console.error("[Yjs] Request state error:", err);
      socket.emit("yjs:error", {
        fileId,
        message: err.message,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLE UPDATE (User edit)
  // ═══════════════════════════════════════════════════════════

  async handleUpdate(socket, fileId, update) {
    const { userId, userName } = socket;

    try {
      // Step 1: Validate EDIT permission
      const validation = await this.permissionValidator.validateAction(
        userId,
        fileId,
        "EDIT",
      );

      if (!validation.allowed) {
        // CRITICAL: User lost edit permission mid-session
        return socket.emit("permission:denied", {
          fileId,
          action: "EDIT",
          reason: validation.reason,
          message: validation.message,
          currentMode: validation.currentMode,
        });
      }

      // Step 2: Apply update to Shadow Y.Doc
      // Sirf new Uint8Array(update) karne ki jagah Buffer logic use karein
      const binaryUpdate = Buffer.isBuffer(update)
        ? new Uint8Array(update)
        : new Uint8Array(Object.values(update)); // Agar JSON array ban gaya ho toh

      console.log(
        "[yjs handler] binary update size:",
        binaryUpdate.length,
        // binaryUpdate,
      );

      // YJS decoding check
      if (binaryUpdate.length === 0) return;

      await this.yjsDocManager.applyDelta(fileId, binaryUpdate);

      // socket.to(...) ka matlab hai: "Bhejne waale ko chhod kar, room mein baki sabko bhejo"
      // Isse 'Echo' problem solve ho jati hai bina kisi extra logic ke.

      console.log(
        `[Yjs] Broadcasting update to room file:${fileId} from ${userName}`,
      );

      socket.to(`file:${fileId}`).emit("yjs:update", {
        fileId,
        update: binaryUpdate, // Socket.io raw binary handle kar leta hai
        userId,
        userName,
      });

      if (this.conflictHandler) {
        console.log("[Yjs] Triggering conflict detection after update... ");

        const code = binaryUpdate
          ? await this._extractCodeFromUpdate(fileId)
          : null;
        if (code) {
          await this.conflictHandler.detectAndBroadcast({
            fileId,
            code,
            language: await this._getFileLanguage(fileId),
            userId,
            socket,
          });
        }
      }

      // Step 5: Schedule disk flush (debounced)
      this.scheduleDiskFlush(fileId);

      // Step 6: Backup to Redis (debounced)
      this.scheduleRedisBackup(fileId);
    } catch (err) {
      console.error("[Yjs] Update error:", err);
      socket.emit("yjs:error", {
        fileId,
        message: err.message,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HANDLE AWARENESS (Cursor updates)
  // ═══════════════════════════════════════════════════════════

  async handleAwareness(socket, fileId, awarenessState) {
    const { userId } = socket;

    try {
      // Update cursor position in session
      await this.sessionManager.updateCursorPosition(
        fileId,
        userId,
        awarenessState.cursor,
      );

      // Broadcast to others (already handled in SessionManager)
      // No additional action needed here
    } catch (err) {
      console.error("[Yjs] Awareness error:", err);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SCHEDULE DISK FLUSH (Debounced)
  // ═══════════════════════════════════════════════════════════

  scheduleDiskFlush(fileId) {
    // Clear existing timer
    if (this.flushTimers.has(fileId)) {
      clearTimeout(this.flushTimers.get(fileId));
    }

    // Set new timer (30s idle timeout)
    const timer = setTimeout(async () => {
      try {
        await this.yjsDocManager.flushToDisk(fileId);
        console.log(`[Yjs] Flushed ${fileId} to disk`);
      } catch (err) {
        console.error("[Yjs] Flush error:", err);
      }
      this.flushTimers.delete(fileId);
    }, 30 * 1000); // 30 seconds

    this.flushTimers.set(fileId, timer);
  }

  // ═══════════════════════════════════════════════════════════
  // SCHEDULE REDIS BACKUP (Debounced)
  // ═══════════════════════════════════════════════════════════

  scheduleRedisBackup(fileId) {
    // Debounce 2 seconds
    setTimeout(async () => {
      try {
        await this.yjsDocManager.backupToRedis(fileId);
        console.log(`[Yjs] Flushed ${fileId} to redis backup`);
      } catch (err) {
        console.error("[Yjs] Redis backup error:", err);
      }
    }, 2000);
  }

  async _extractCodeFromUpdate(fileId) {
    try {
      const docData = await this.yjsDocManager.getOrCreateDoc(fileId);
      return docData?.ytext?.toString() || null;
    } catch (err) {
      console.error("[YjsHandler] Error extracting code:", err);
      return null;
    }
  }
  async _getCleanCodeForLSP(fileId) {
    try {
      const code = await this._extractCodeFromUpdate(fileId);
      if (!code) return null;
      // Use global sanitizer to remove markers
      if (global.lspSanitizer) {
        return global.lspSanitizer.sanitize(code);
      }

      return code;
    } catch (err) {
      console.error("[YjsHandler] Error cleaning code for LSP:", err);
      return null;
    }
  }

  async _getFileLanguage(fileId) {
    // TODO: Get from DB or cache
    // For now, detect from file extension
    try {
      const ext = fileId.split(".").pop();
      const languageMap = {
        js: "javascript",
        jsx: "javascript",
        ts: "javascript",
        tsx: "javascript",
        py: "python",
        java: "java",
        cpp: "cpp",
        go: "go",
      };
      return languageMap[ext] || "javascript";
    } catch (err) {
      return "javascript";
    }
  }
}

export default YjsHandler;
