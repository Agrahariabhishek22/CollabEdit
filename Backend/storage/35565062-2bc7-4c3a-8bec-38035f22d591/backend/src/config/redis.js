import { Redis } from "ioredis";

// 1. Ek connection instance
export const redisConnection = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});

// 2. Check karne ke liye function
const connectRedis = async () => {
  console.log("Connecting to Redis..."); // Ye log add karo
  return new Promise((resolve, reject) => {
    
    // Agar pehle se connected hai toh turant resolve karo
    if (redisConnection.status === "ready") {
      console.log("Redis already ready");
      resolve();
    }

    redisConnection.on("connect", () => {
      console.log("Redis event: connect");
      resolve();
    });

    // Timeout add karo taaki pata chale agar connect nahi ho raha
    setTimeout(() => {
      reject(new Error("Redis connection timeout (10 seconds)"));
    }, 10000);
  });
};
export default connectRedis;