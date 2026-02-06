// socket/handlers/yjs.handler.js

class YjsHandler {
  constructor(
    io,
    yjsDocManager,
    permissionValidator,
    sessionManager,
    redis
  ) {
    this.io = io;
    this.yjsDocManager = yjsDocManager;
    this.permissionValidator = permissionValidator;
    this.sessionManager = sessionManager;
    this.redis = redis;
    
    // Debounce timers for flush
    this.flushTimers = new Map();
  }

  register(socket) {
    // ═══════════════════════════════════════════════════════════
    // REQUEST INITIAL STATE
    // ═══════════════════════════════════════════════════════════

    socket.on('yjs:request-state', async ({ fileId }) => {
      await this.handleRequestState(socket, fileId);
    });

    // ═══════════════════════════════════════════════════════════
    // SEND UPDATE (User types)
    // ═══════════════════════════════════════════════════════════

    socket.on('yjs:update', async ({ fileId, update }) => {
      await this.handleUpdate(socket, fileId, update);
    });

    // ═══════════════════════════════════════════════════════════
    // AWARENESS (Cursor position)
    // ═══════════════════════════════════════════════════════════

    socket.on('yjs:awareness', async ({ fileId, state }) => {
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
        'READ'
      );

      if (!validation.allowed) {
        return socket.emit('yjs:error', {
          fileId,
          message: 'Access denied',
        });
      }

      // Get or create Shadow Y.Doc
      const docData = await this.yjsDocManager.getOrCreateDoc(fileId);

      // Add user to doc's user set
      this.yjsDocManager.addUser(fileId, userId);

      // Send full state to user
      const stateVector = await this.yjsDocManager.getStateVector(fileId);

      socket.emit('yjs:state', {
        fileId,
        state: Array.from(stateVector), // Convert Uint8Array to array
        timestamp: Date.now(),
      });

      console.log(`[Yjs] Sent initial state to ${socket.userName} for ${fileId}`);

    } catch (err) {
      console.error('[Yjs] Request state error:', err);
      socket.emit('yjs:error', {
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
        'EDIT'
      );

      if (!validation.allowed) {
        // CRITICAL: User lost edit permission mid-session
        return socket.emit('permission:denied', {
          fileId,
          action: 'EDIT',
          reason: validation.reason,
          message: validation.message,
          currentMode: validation.currentMode,
        });
      }

      // Step 2: Apply update to Shadow Y.Doc
      const binaryUpdate = new Uint8Array(update);
      await this.yjsDocManager.applyDelta(fileId, binaryUpdate);

      // Step 3: Broadcast to all OTHER users in room (via Redis Pub/Sub)
      await this.redis.publish(
        `yjs:update:${fileId}`,
        JSON.stringify({
          userId,
          userName,
          update: Array.from(binaryUpdate),
          timestamp: Date.now(),
        })
      );

      // Step 4: Schedule disk flush (debounced)
      this.scheduleDiskFlush(fileId);

      // Step 5: Backup to Redis (debounced)
      this.scheduleRedisBackup(fileId);

    } catch (err) {
      console.error('[Yjs] Update error:', err);
      socket.emit('yjs:error', {
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
        awarenessState.cursor
      );

      // Broadcast to others (already handled in SessionManager)
      // No additional action needed here

    } catch (err) {
      console.error('[Yjs] Awareness error:', err);
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
        console.error('[Yjs] Flush error:', err);
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
      } catch (err) {
        console.error('[Yjs] Redis backup error:', err);
      }
    }, 2000);
  }
}

export default YjsHandler;