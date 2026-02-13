// services/session/SessionManager.js

/**
 * SESSION HIERARCHY:
 * * User Session (Global)
 * └─ Tab Session (Per Browser Tab)
 * └─ File Session (Active File in Tab)
 * * Redis Keys:
 * - session:{userId}                → User metadata + JWT
 * - tab:{tabId}                     → Tab info (userId, connected)
 * - file_session:{fileId}           → Active users on file
 * - user_active_file:{userId}       → Current file user is editing
 */

export default class SessionManager {
  constructor(redisClient, io) {
    this.redis = redisClient;
    this.io = io;
  }
  setIo(io) {
    this.io = io;
    console.log("[SessionManager] Socket.io instance injected successfully.");
  }
  // ═══════════════════════════════════════════════════════════
  // USER SESSION (Login/Logout)
  // ═══════════════════════════════════════════════════════════

  async createUserSession(userId, socketId, metadata) {
    const sessionData = {
      userId,
      socketId,
      connectedAt: Date.now(),
      ...metadata,
    };

    // Store in Redis with 24h TTL
    // Node-Redis v4 use .set(key, value, { EX: seconds })
    await this.redis.set(`session:${userId}`, JSON.stringify(sessionData), {
      EX: 86400, // 24 hours in seconds
    });

    // Track socket → user mapping
    await this.redis.hSet("socket_to_user", socketId, userId);
  }

  async getUserSession(userId) {
    const data = await this.redis.get(`session:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  async destroyUserSession(userId) {
    const session = await this.getUserSession(userId);
    if (session) {
      await this.redis.hDel("socket_to_user", session.socketId);
    }
    await this.redis.del(`session:${userId}`);
  }

  // ═══════════════════════════════════════════════════════════
  // TAB SESSION (Multi-Tab Detection)
  // ═══════════════════════════════════════════════════════════

  async registerTab(userId, tabId, socketId) {
    const tabData = {
      tabId,
      userId,
      socketId,
      createdAt: Date.now(),
    };

    // setex is deprecated in v4, use set with EX option
    await this.redis.set(`tab:${tabId}`, JSON.stringify(tabData), {
      EX: 3600, // 1 hour TTL
    });

    // Add to user's tab set
    await this.redis.sAdd(`user_tabs:${userId}`, tabId);
  }

  async getActiveTabs(userId) {
    const tabIds = await this.redis.sMembers(`user_tabs:${userId}`);
    const tabs = [];

    for (const tabId of tabIds) {
      const data = await this.redis.get(`tab:${tabId}`);
      if (data) tabs.push(JSON.parse(data));
    }

    return tabs;
  }

  async removeTab(tabId) {
    const data = await this.redis.get(`tab:${tabId}`);
    if (data) {
      const { userId } = JSON.parse(data);
      await this.redis.sRem(`user_tabs:${userId}`, tabId);
    }
    await this.redis.del(`tab:${tabId}`);
  }

  // ═══════════════════════════════════════════════════════════
  // FILE SESSION (Active File Tracking)
  // ═══════════════════════════════════════════════════════════

  async joinFileSession(
    fileId,
    userId,
    tabId,
    userName,
    userEmail,
    accessMode,
  ) {
    const participant = {
      userId,
      userName,
      userEmail,
      tabId,
      accessMode, // 'ADMIN' | 'EDITOR' | 'VIEWER'
      joinedAt: Date.now(),
      cursor: null,
      selection: null,
    };

    // Add to file's active users (Hash)
    await this.redis.hSet(
      `file_session:${fileId}`,
      userId,
      JSON.stringify(participant),
    );

    // Track user's current file
    await this.redis.set(`user_active_file:${userId}:${tabId}`, fileId);

    // Join Socket.io room
    const socketId = await this.getSocketId(userId);
    const socket = this.io.sockets.sockets.get(socketId);

    if (socket) socket.join(`file:${fileId}`);

    // Broadcast to others
    this.io.to(`file:${fileId}`).emit("user:joined", {
      fileId,
      user: participant,
    });

    return participant;
  }

async leaveFileSession(fileId, userId, tabId) {
    // 🟢 1. Pehle cursor ko null bhej kar broadcast karo
    // Hum updateCursorPosition call karenge taaki baaki sabka UI saaf ho jaye
    // Note: Humein user ki info Redis se nikalni hogi broadcast ke liye
    const userData = await this.redis.hGet(`file_session:${fileId}`, userId);
    if (userData) {
      const p = JSON.parse(userData);
      // Cursor null bhej rahe hain taaki frontend user marker remove karde
      await this.updateCursorPosition(fileId, userId, p.userName, p.userEmail, null);
    }

    // 🟢 2. Ab session data remove karo Redis se
    await this.redis.hDel(`file_session:${fileId}`, userId);

    // 🟢 3. Clear active file tracker
    await this.redis.del(`user_active_file:${userId}:${tabId}`);

    // 🟢 4. Leave Socket.io room
    const socketId = await this.getSocketId(userId);
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) socket.leave(`file:${fileId}`);

    // 🟢 5. Final Broadcast (Existing logic)
    this.io.to(`file:${fileId}`).emit("user:left", {
      fileId,
      userId,
    });
    
    console.log(`[Session Manager] User ${userId} left file ${fileId}, cursor cleared.`);
  }

  async getFileParticipants(fileId) {
    // hGetAll returns a plain object in v4
    const data = await this.redis.hGetAll(`file_session:${fileId}`);
    const participants = {};

    for (const [userId, json] of Object.entries(data)) {
      participants[userId] = JSON.parse(json);
    }

    return participants;
  }

  async updateCursorPosition(fileId, userId, userName, userEmail, cursor) {
    const data = await this.redis.hGet(`file_session:${fileId}`, userId);
    if (data) {
      const participant = JSON.parse(data);
      participant.cursor = cursor;
      participant.lastActivity = Date.now();

      await this.redis.hSet(
        `file_session:${fileId}`,
        userId,
        JSON.stringify(participant),
      );
      console.log(
        "[Session Manager update cursor pos] Updated File_sessionnow emiting",
        cursor,
      );

      // Broadcast to others (throttled at socket level)
      this.io.to(`file:${fileId}`).emit("cursor:update", {
        userId,
        userName,
        userEmail,
        cursor,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════

  async getSocketId(userId) {
    const session = await this.getUserSession(userId);
    return session?.socketId;
  }

  async getUserIdFromSocket(socketId) {
    return await this.redis.hGet("socket_to_user", socketId);
  }
}
