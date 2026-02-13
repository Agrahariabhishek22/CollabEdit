// src/socket/handlers/fileConnection.handler.js

class FileConnectionHandler {
  constructor(
    io,
    sessionManager,
    permissionValidator,
    yjsDocManager,
    lspManager,
  ) {
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

    // // Cursor update (Real-time cursor position)
    socket.on("cursor:update", async (data) => {
      await this.handleCursorUpdate(socket, data);
    });
  }

  async handleFileJoin(socket, { fileId, projectId }) {
    const { userId, userName, tabId ,userEmail} = socket;

    try {
      // 1. Permission Check (Intact)
      const validation = await this.permissionValidator.validateAction(
        userId,
        fileId,
        "READ",
      );
      if (!validation.allowed) {
        return socket.emit("file:join-error", {
          fileId,
          message: validation.message,
        });
      }

      // 2. Yjs Shadow Doc Rehydration (New! 🚀)
      // Ye function file ko RAM mein layega aur Redis registry update karega
      console.log(`[Yjs] Rehydrating doc for file ${fileId} (User: ${userName})`);
      await this.yjsDocManager.getOrCreateDoc(fileId);

      // Doc manager mein user ko add karo taaki cleanup scheduler ko pata rahe
      await this.yjsDocManager.addUser(fileId, userId);

      // 3. Get Initial Binary State (The "Handshake")
      // User ko editor chalane ke liye current content ka binary chahiye
      const initialState = await this.yjsDocManager.getStateVector(fileId);

      // 4. Join Session & Rooms (Intact)
      const participant = await this.sessionManager.joinFileSession(
        fileId,
        userId,
        tabId,
        userName,
        userEmail,
        validation.mode,
      );
      socket.join(`file:${fileId}`);
      socket.currentFileId = fileId;

      // 5. Send Confirmation + INITIAL CONTENT
      socket.emit("file:joined", {
        fileId,
        accessMode: validation.mode,
        participants: await this.sessionManager.getFileParticipants(fileId),
        initialState: Buffer.from(initialState), // 👈 Ye user ka editor "re-construct" karega
        timestamp: Date.now(),
      });

      // 6. Notify Others (Intact)
      socket.to(`file:${fileId}`).emit("user:joined", {
        fileId,
        user: {
          userId,
          userName,
          accessMode: validation.mode,
          joinedAt: participant.joinedAt,
        },
      });

      console.log(`[File] ${userName} joined ${fileId} with Yjs rehydration`);
    } catch (err) {
      console.error("[File Join Error]:", err);
      socket.emit("file:join-error", { fileId, message: err.message });
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
    const { userId,userName,userEmail } = socket;
    console.log("[Cursor Update] Recieved cursor update from user",userName,cursor);
    
    try {
      await this.sessionManager.updateCursorPosition(fileId, userId,userName,userEmail, cursor);
    } catch (err) {
      console.error("[Cursor Update] Error:", err);
    }
  } 

  async handleDisconnect(socket) {
    const { userId, currentFileId, tabId } = socket;
console.log(`[Disconnect] Cleaning up for user ${userId} (File: ${currentFileId})`);
    try {
      // Leave current file if any
      if (currentFileId) {
        await this.sessionManager.leaveFileSession(
          currentFileId,
          userId,
          tabId,
        );
      }
    } catch (err) {
      console.error("[Disconnect Cleanup] Error:", err);
    }
  }
}

export default FileConnectionHandler;
