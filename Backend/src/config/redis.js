// Redis Connection & Caching
import { createClient } from "redis";
import { config } from "./env.js";

let redisClient = null;
let redisSubscriber = null;

export const connectRedis = async () => {
  try {
    const clientConfig = {
      url: `redis://${config.REDIS_PASSWORD ? `:${config.REDIS_PASSWORD}@` : ''}${config.REDIS_HOST}:${config.REDIS_PORT}`,
      // Ya fir socket use karo (Zyada reliable in Docker)
      socket: {
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        reconnectStrategy: (retries) => {
          if (retries > 10) return new Error("Max retries reached");
          return Math.min(retries * 100, 3000);
        }
      }
    };
    redisClient =createClient(clientConfig);

    redisClient.on("error", (err) => console.error("Redis Client Error:", err));
    redisClient.on("connect", () => console.log("✓ Redis Client Connected"));

    await redisClient.connect();

    // Separate subscriber for pub/sub
    redisSubscriber = createClient(clientConfig);
    
    redisSubscriber.on("error", (err) => console.error("Redis Subscriber Error:", err));
    await redisSubscriber.connect();

    console.log("✓ Redis Subscriber Connected");

    return { redisClient, redisSubscriber };
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    throw error;
  }
};

// Session Management
export const setSession = async (userId, sessionData) => {
  try {
    const key = `session:${userId}`;
    await redisClient.setEx(key, config.SESSION_TTL, JSON.stringify(sessionData));
    return true;
  } catch (error) {
    console.error("Error setting session:", error);
    throw error;
  }
};

export const getSession = async (userId) => {
  try {
    const key = `session:${userId}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error getting session:", error);
    return null;
  }
};

export const deleteSession = async (userId) => {
  try {
    const key = `session:${userId}`;
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error("Error deleting session:", error);
    throw error;
  }
};

// Token Blacklist (for logout)
export const blacklistToken = async (token, expiresIn = config.SESSION_TTL) => {
  try {
    const key = `blacklist:${token}`;
    await redisClient.setEx(key, expiresIn, "blacklisted");
    return true;
  } catch (error) {
    console.error("Error blacklisting token:", error);
    throw error;
  }
};

export const isTokenBlacklisted = async (token) => {
  try {
    const key = `blacklist:${token}`;
    const exists = await redisClient.exists(key);
    return exists === 1;
  } catch (error) {
    console.error("Error checking blacklist:", error);
    return false;
  }
};

// Chat History (Rolling Buffer)
export const pushChatMessage = async (projectId, message) => {
  try {
    const key = `chat:${projectId}`;
    await redisClient.rPush(key, JSON.stringify(message));
    // Keep only last 50 messages
    await redisClient.lTrim(key, -50, -1);
    return true;
  } catch (error) {
    console.error("Error pushing chat message:", error);
    throw error;
  }
};

export const getChatHistory = async (projectId) => {
  try {
    const key = `chat:${projectId}`;
    const messages = await redisClient.lRange(key, 0, -1);
    return messages.map((msg) => JSON.parse(msg));
  } catch (error) {
    console.error("Error getting chat history:", error);
    return [];
  }
};

// Heartbeat Tracking
export const setHeartbeat = async (userId, projectId) => {
  try {
    const key = `heartbeat:${userId}:${projectId}`;
    await redisClient.setEx(key, 120, new Date().toISOString()); // 2 minute TTL
    return true;
  } catch (error) {
    console.error("Error setting heartbeat:", error);
    throw error;
  }
};

// Get Redis client instance
export const getRedisClient = () => redisClient;

export const getRedisSubscriber = () => redisSubscriber;

export default {
  connectRedis,
  setSession,
  getSession,
  deleteSession,
  blacklistToken,
  isTokenBlacklisted,
  pushChatMessage,
  getChatHistory,
  setHeartbeat,
  getRedisClient,
  getRedisSubscriber,
};
