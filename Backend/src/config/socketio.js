// src/config/socketio.js
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedisClient, getRedisSubscriber } from "./redis.js";
import { config } from "./env.js";

// ════════════════════════════════════════════════════════════
// SOCKET.IO INSTANCE (Global singleton)
// ════════════════════════════════════════════════════════════

let io = null;

// ════════════════════════════════════════════════════════════
// INITIALIZE SOCKET.IO WITH REDIS ADAPTER
// 
// PURPOSE:
// - Redis Adapter enables horizontal scaling
// - Events broadcast to ALL server instances via Redis Pub/Sub
// - Example: User A on Server 1 sends message → User B on Server 2 receives it
// 
// HOW IT WORKS:
// io.emit('event') → Adapter publishes to Redis → All servers receive → Broadcast to their clients
// ════════════════════════════════════════════════════════════

export const initSocketIO = (server) => {
  try {
    // Get Redis clients for adapter
    const pubClient = getRedisClient();
    const subClient = getRedisSubscriber();

    // Initialize Socket.io
    io = new Server(server, {
      cors: {
        origin: config.CORS_ORIGIN.split(","),
        credentials: true,
      },
      transports: ["websocket", "polling"],
      pingInterval: 25000,  // Send ping every 25s
      pingTimeout: 60000,   // Disconnect if no pong in 60s
    });

    // ════════════════════════════════════════════════════════
    // REDIS ADAPTER (Horizontal Scaling)
    // 
    // Without adapter: Events only reach clients on same server
    // With adapter: Events reach ALL clients across ALL servers
    // 
    // Mechanism:
    // 1. Server 1: socket.to('room').emit('event', data)
    // 2. Adapter: PUBLISH to Redis channel
    // 3. Redis: Broadcast to all subscribed servers
    // 4. Server 2, 3, ...: Receive and emit to their clients
    // ════════════════════════════════════════════════════════
    io.adapter(createAdapter(pubClient, subClient));

    console.log("✓ Socket.io initialized with Redis Adapter");

    return io;
  } catch (error) {
    console.error("✗ Socket.io initialization failed:", error);
    throw error;
  }
};

// ════════════════════════════════════════════════════════════
// GET SOCKET.IO INSTANCE (For use in routes/services)
// ════════════════════════════════════════════════════════════

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initSocketIO first.");
  }
  return io;
};

export default {
  initSocketIO,
  getIO,
};