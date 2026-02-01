// Prisma Client Initialization
// src/config/database.js
import { PrismaClient } from "@prisma/client";

// Sidha initialize karke export karo
// Ye line file load hote hi execute ho jayegi
export const prisma = new PrismaClient({
  log: ["info", "warn", "error"],
});

export const connectDatabase = async () => {
  try {
    // Sirf connection test karne ke liye query
    await prisma.$queryRaw`SELECT 1`;
    console.log("✓ Database connected successfully");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
};

export const getPrismaClient = async() => {
  if (!prisma) {
    throw new Error("Database not initialized. Call connectDatabase first.");
  }
  return prisma;
};

export const disconnectDatabase = async () => {
  if (prisma) {
    await prisma.$disconnect();
    console.log("✓ Database disconnected");
  }
};

export default {
  connectDatabase,
  getPrismaClient,
  disconnectDatabase,
};
