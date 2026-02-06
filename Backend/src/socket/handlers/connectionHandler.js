// src/socket/handlers/connectionHandler.js

import { getSession, setHeartbeat, setSession } from "../../config/redis.js";
import { config } from "../../config/env.js";
import jwt from "jsonwebtoken";
import cookie from "cookie";

// ════════════════════════════════════════════════════════════
// SOCKET AUTHENTICATION MIDDLEWARE
// ════════════════════════════════════════════════════════════
export const socketAuth = async (socket, next) => {
  try {
    console.log("I am inside socket auth to authenticate myself");
    
    const cookies = cookie.parse(socket.handshake.headers.cookie || "");
    const token = cookies.token;

    if (!token) {
      return next(new Error("Authentication failed: No token provided"));
    }

    // Verify JWT
    const decoded = jwt.verify(token, config.JWT_SECRET);
    socket.userId = decoded.id;
    socket.userEmail = decoded.email;
    socket.userName = decoded.name ;
console.log(decoded);

    // Verify session exists in Redis
    const session = await getSession(decoded.id);
    if (!session) {
      return next(new Error("Session expired"));
    }

    socket.userData = decoded;
    
    // Generate tab ID (for multi-tab support)
    socket.tabId = socket.handshake.query.tabId || `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // console.log(socket);
    
    next();
  } catch (error) {
    next(new Error(`Authentication failed: ${error.message}`));
  }
};

// ════════════════════════════════════════════════════════════
// HANDLE CONNECTION (Basic Setup)
// ════════════════════════════════════════════════════════════
export const handleConnection = async (socket) => {
  const { userId, userName, userEmail, tabId } = socket;

  console.log(`✓ User connected: ${userName} (${userId}) - Socket: ${socket.id} - Tab: ${tabId}`);

  // Emit welcome message
  socket.emit("connection-established", {
    message: "Connected to CollabEdit server",
    userId,
    userName,
    userEmail,
    tabId,
    socketId: socket.id,
    timestamp: new Date(),
  });

  // Join user room (for personal notifications)
  socket.join(`user:${userId}`);

  // Store socket metadata in Redis (for session management)
  try {
    const sessionManager = global.sessionManager;
    if (sessionManager) {
      await sessionManager.createUserSession(userId, socket.id, {
        userName,
        userEmail,
        tabId,
      });

      await sessionManager.registerTab(userId, tabId, socket.id);
    }
  } catch (error) {
    console.error("[Connection] Session creation error:", error);
  }
};

// ════════════════════════════════════════════════════════════
// HANDLE DISCONNECTION (Basic Cleanup)
// ════════════════════════════════════════════════════════════
export const handleDisconnection = async (socket) => {
  const { userId, userName, tabId } = socket;

  console.log(`✗ User disconnected: ${userName} (${userId}) - Socket: ${socket.id}`);

  try {
    const sessionManager = global.sessionManager;
    if (sessionManager) {
      // Remove tab
      await sessionManager.removeTab(tabId);

      // Check if user has other tabs open
      const activeTabs = await sessionManager.getActiveTabs(userId);

      if (activeTabs.length === 0) {
        // No more tabs, destroy user session
        await sessionManager.destroyUserSession(userId);
        console.log(`  → All tabs closed for user ${userId}`);
      } else {
        console.log(`  → User ${userId} still has ${activeTabs.length} tabs open`);
      }
    }
  } catch (error) {
    console.error("[Disconnect] Cleanup error:", error);
  }
};

// ════════════════════════════════════════════════════════════
// HEARTBEAT HANDLER (Keep Session Alive)
// ════════════════════════════════════════════════════════════
export const handleHeartbeat = async (socket, data) => {
  try {
    const { projectId } = data;

    if (!projectId) {
      socket.emit("heartbeat-error", { message: "projectId required" });
      return;
    }

    // Update heartbeat in Redis
    await setHeartbeat(socket.userId, projectId);

    // Extend session TTL
    const session = await getSession(socket.userId);
    if (session) {
      await setSession(socket.userId, session);
    }

    socket.emit("heartbeat-ack", {
      status: "alive",
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("[Heartbeat] Error:", error);
    socket.emit("heartbeat-error", { message: error.message });
  }
};

// ════════════════════════════════════════════════════════════
// JOIN PROJECT ROOM (Existing Logic)
// ════════════════════════════════════════════════════════════
export const handleJoinProject = async (socket, data) => {
  try {
    const { projectId } = data;

    if (!projectId) {
      socket.emit("room-error", { message: "projectId required" });
      return;
    }

    // Verify access (existing logic)
    const prisma = global.prisma;
    const isInvited = await prisma.collaboratorDetail.findFirst({
      where: {
        fileMetaId: projectId,
        OR: [
          { adminId: socket.userId },
          { editors: { has: socket.userId } },
          { viewers: { has: socket.userId } },
        ],
      },
    });

    if (!isInvited) {
      return socket.emit("room-error", {
        message: "Access Denied: You are not invited to this project",
      });
    }

    const roomName = `project:${projectId}`;
    socket.join(roomName);

    console.log(`✓ User ${socket.userName} joined room ${roomName}`);

    // Notify others
    socket.broadcast.to(roomName).emit("user-joined", {
      userId: socket.userId,
      userName: socket.userName,
      timestamp: new Date(),
      message: `${socket.userName} joined the project`,
    });

    socket.emit("room-joined", {
      roomName,
      projectId,
      message: "Joined project room successfully",
    });
  } catch (error) {
    console.error("[Join Project] Error:", error);
    socket.emit("room-error", { message: error.message });
  }
};

// ════════════════════════════════════════════════════════════
// LEAVE PROJECT ROOM (Existing Logic)
// ════════════════════════════════════════════════════════════
export const handleLeaveProject = (socket, data) => {
  try {
    const { projectId } = data;

    if (!projectId) {
      socket.emit("room-error", { message: "projectId required" });
      return;
    }

    const roomName = `project:${projectId}`;
    socket.leave(roomName);

    console.log(`✗ User ${socket.userName} left room ${roomName}`);

    // Notify others
    socket.broadcast.to(roomName).emit("user-left", {
      userId: socket.userId,
      userName: socket.userName,
      timestamp: new Date(),
      message: `${socket.userName} left the project`,
    });

    socket.emit("room-left", {
      roomName,
      projectId,
      message: "Left project room",
    });
  } catch (error) {
    console.error("[Leave Project] Error:", error);
    socket.emit("room-error", { message: error.message });
  }
};

// ════════════════════════════════════════════════════════════
// GENERIC ERROR HANDLER
// ════════════════════════════════════════════════════════════
export const handleError = (socket, error) => {
  console.error(`[Socket Error] User ${socket.userId}:`, error);
  socket.emit("socket-error", {
    message: error.message || "An error occurred",
    code: error.code || "UNKNOWN_ERROR",
    timestamp: new Date(),
  });
};