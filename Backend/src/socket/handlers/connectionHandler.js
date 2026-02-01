// Socket.io Connection & Heartbeat Handlers
import { getSession, setHeartbeat, setSession } from "../../config/redis.js";
import { config } from "../../config/env.js";
import jwt from "jsonwebtoken";

// Socket.io Authentication Middleware
export const socketAuth = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Authentication failed: No token provided"));
    }

    // Verify JWT
    const decoded = jwt.verify(token, config.JWT_SECRET);
    socket.userId = decoded.id;

    // Verify session exists in Redis
    const session = await getSession(decoded.id);
    if (!session) {
      return next(new Error("Session expired"));
    }

    socket.userData = decoded;
    next();
  } catch (error) {
    next(new Error(`Authentication failed: ${error.message}`));
  }
};

// Handle connection
export const handleConnection = (socket) => {
  console.log(`✓ User ${socket.userId} connected - Socket ID: ${socket.id}`);

  // Emit welcome message
  socket.emit("connection-established", {
    message: "Connected to server",
    userId: socket.userId,
    timestamp: new Date(),
  });

  // Join user room (for personal notifications)
  socket.join(`user:${socket.userId}`);
};

// Handle disconnection
export const handleDisconnection = (socket) => {
  console.log(`✗ User ${socket.userId} disconnected - Socket ID: ${socket.id}`);
};

// Heartbeat handler - Keep session alive
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
    console.error("Heartbeat error:", error);
    socket.emit("heartbeat-error", { message: error.message });
  }
};

// Join project room
export const handleJoinProject = async (socket, data) => {
  try {
    const { projectId } = data;

    if (!projectId) {
      socket.emit("room-error", { message: "projectId required" });
      return;
    }
    const isInvited = await prisma.collaboratorDetail.findFirst({
      where: {
        fileMetaId: projectId, // Assuming projectId maps to root fileMeta
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

    console.log(`✓ User ${socket.userId} joined room ${roomName}`);

    // Notify others
    socket.broadcast.to(roomName).emit("user-joined", {
      userId: socket.userId,
      timestamp: new Date(),
      message: `User joined the project`,
    });

    socket.emit("room-joined", {
      roomName,
      message: "Joined project room successfully",
    });
  } catch (error) {
    console.error("Join room error:", error);
    socket.emit("room-error", { message: error.message });
  }
};

// Leave project room
export const handleLeaveProject = (socket, data) => {
  try {
    const { projectId } = data;

    if (!projectId) {
      socket.emit("room-error", { message: "projectId required" });
      return;
    }

    const roomName = `project:${projectId}`;
    socket.leave(roomName);

    console.log(`✗ User ${socket.userId} left room ${roomName}`);

    // Notify others
    socket.broadcast.to(roomName).emit("user-left", {
      userId: socket.userId,
      timestamp: new Date(),
      message: `User left the project`,
    });

    socket.emit("room-left", {
      roomName,
      message: "Left project room",
    });
  } catch (error) {
    console.error("Leave room error:", error);
    socket.emit("room-error", { message: error.message });
  }
};

// Generic error handler
export const handleError = (socket, error) => {
  console.error(`Socket error from ${socket.userId}:`, error);
  socket.emit("socket-error", {
    message: error.message || "An error occurred",
    code: error.code || "UNKNOWN_ERROR",
  });
};
