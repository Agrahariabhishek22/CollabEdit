// src/socket/handlers/fileConnection.handler.js

class FileConnectionHandler {
  constructor(io, sessionManager, permissionValidator, yjsDocManager, lspManager) {
    this.io = io;
    this.sessionManager = sessionManager;
    this.permissionValidator = permissionValidator;
    this.yjsDocManager = yjsDocManager;
    this.lspManager = lspManager;
  }

  register(socket) {
    // File join (User opens file in editor)
    socket.on("file:join", async (data) => {
      await this.handleFileJoin(socket, data);
    });

    // File leave (User closes file)
    socket.on("file:leave", async (data) => {
      await this.handleFileLeave(socket, data);
    });

    // Cursor update (Real-time cursor position)
    socket.on("cursor:update", async (data) => {
      await this.handleCursorUpdate(socket, data);
    });
  }

  async handleFileJoin(socket, { fileId, projectId }) {
    const { userId, userName, tabId } = socket;

    try {
      // Validate access
      const validation = await this.permissionValidator.validateAction(
        userId,
        fileId,
        "READ"
      );

      if (!validation.allowed) {
        return socket.emit("file:join-error", {
          fileId,
          reason: validation.reason,
          message: validation.message,
        });
      }

      // Join file session
      const participant = await this.sessionManager.joinFileSession(
        fileId,
        userId,
        tabId,
        validation.mode
      );

      // Join Socket.io room
      socket.join(`file:${fileId}`);
      socket.currentFileId = fileId;

      // Get current participants
      const participants = await this.sessionManager.getFileParticipants(fileId);

      // Send confirmation
      socket.emit("file:joined", {
        fileId,
        accessMode: validation.mode,
        participants: Object.values(participants),
        timestamp: Date.now(),
      });

      // Notify others
      socket.to(`file:${fileId}`).emit("user:joined", {
        fileId,
        user: {
          userId,
          userName,
          accessMode: validation.mode,
          joinedAt: participant.joinedAt,
        },
      });

      console.log(`[File] ${userName} joined ${fileId} as ${validation.mode}`);

    } catch (err) {
      console.error("[File Join] Error:", err);
      socket.emit("file:join-error", {
        fileId,
        message: err.message,
      });
    }
  }

  async handleFileLeave(socket, { fileId }) {
    const { userId, tabId } = socket;

    try {
      await this.sessionManager.leaveFileSession(fileId, userId, tabId);
      socket.leave(`file:${fileId}`);
      socket.currentFileId = null;

      socket.emit("file:left", { fileId });

      console.log(`[File] User ${userId} left ${fileId}`);

    } catch (err) {
      console.error("[File Leave] Error:", err);
    }
  }

  async handleCursorUpdate(socket, { fileId, cursor }) {
    const { userId } = socket;

    try {
      await this.sessionManager.updateCursorPosition(fileId, userId, cursor);
    } catch (err) {
      console.error("[Cursor Update] Error:", err);
    }
  }

  async handleDisconnect(socket) {
    const { userId, currentFileId, tabId } = socket;

    try {
      // Leave current file if any
      if (currentFileId) {
        await this.sessionManager.leaveFileSession(currentFileId, userId, tabId);
      }

    } catch (err) {
      console.error("[Disconnect Cleanup] Error:", err);
    }
  }
}

export default FileConnectionHandler;