// Environment Configuration
export const config = {
  // Server
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
  HOST: "0.0.0.0",

  // Database
  DATABASE_URL: process.env.DATABASE_URL,

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || "redis",
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || "",
  REDIS_DB: process.env.REDIS_DB || 0,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production",
  JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "your-super-secret-refresh-key-change-in-production",
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || "30d",

  // Session
  SESSION_TTL: parseInt(process.env.SESSION_TTL || "1800"), // 30 minutes in seconds
  HEARTBEAT_INTERVAL: parseInt(process.env.HEARTBEAT_INTERVAL || "60000"), // 60 seconds in ms

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000",

  // Storage
  STORAGE_PATH: process.env.STORAGE_PATH || "./storage",

  // API Rate Limiting
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
};
