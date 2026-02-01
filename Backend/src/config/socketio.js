// Socket.io Configuration with Redis Adapter
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedisClient, getRedisSubscriber } from "./redis.js";
import { config } from "./env.js";

let io = null;

export const initSocketIO = (server) => {
  try {
    const pubClient = getRedisClient();
    const subClient = getRedisSubscriber();

    io = new Server(server, {
      cors: {
        origin: config.CORS_ORIGIN.split(","),
        credentials: true,
      },
      transports: ["websocket", "polling"],
      pingInterval: 25000,
      pingTimeout: 60000,
    });

    // Use Redis Adapter for horizontal scaling
    /**
     * IO ADAPTER LOGIC:
     * Bina adapter ke, socket events sirf usi server tak limit rehte hain jahan wo trigger hue.
     * io.adapter(createAdapter(...)) karne se Socket.io piche se Redis Pub/Sub use karne lagta hai.
     * Jab tum io.emit() karte ho, toh ye adapter use Redis channel par 'Publish' kar deta hai,
     * aur baki saare server instances use 'Subscribe' karke apne-apne users ko bhej dete hain.
     */
    io.adapter(createAdapter(pubClient, subClient));

    console.log("✓ Socket.io initialized with Redis Adapter");

    return io;
  } catch (error) {
    console.error("Failed to initialize Socket.io:", error);
    throw error;
  }
};

// Get Socket.io instance
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

export default {
  initSocketIO,
  getIO,
};
