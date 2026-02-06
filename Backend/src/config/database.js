// src/config/database.js

import { PrismaClient } from "@prisma/client";

// ════════════════════════════════════════════════════════════
// PRISMA CLIENT (Global singleton instance)
// NOTE: Export immediately - no lazy loading needed
// ════════════════════════════════════════════════════════════

export const prisma = new PrismaClient({
  log: ["info", "warn", "error"],
});

// ════════════════════════════════════════════════════════════
// CONNECT DATABASE (Test connection on startup)
// ════════════════════════════════════════════════════════════

export const connectDatabase = async () => {
  try {
    // Test connection with simple query
    await prisma.$queryRaw`SELECT 1`;
    console.log("✓ Database connected successfully");
    
    // Return prisma for services that need it
    return { prisma };
  } catch (error) {
    console.error("✗ Database connection failed:", error);
    process.exit(1);
  }
};

// ════════════════════════════════════════════════════════════
// GET PRISMA CLIENT (For services)
// NOTE: Most services can directly import { prisma }
// This function is for dynamic access
// ════════════════════════════════════════════════════════════

export const getPrismaClient = () => {
  if (!prisma) {
    throw new Error("Database not initialized. Call connectDatabase first.");
  }
  return prisma;
};

// ════════════════════════════════════════════════════════════
// DISCONNECT DATABASE (Graceful shutdown)
// ════════════════════════════════════════════════════════════

export const disconnectDatabase = async () => {
  try {
    if (prisma) {
      await prisma.$disconnect();
      console.log("✓ Database disconnected");
    }
  } catch (error) {
    console.error("✗ Database disconnect error:", error);
  }
};

export default {
  prisma,
  connectDatabase,
  getPrismaClient,
  disconnectDatabase,
};