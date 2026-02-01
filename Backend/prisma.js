import { PrismaClient } from '@prisma/client';

// Global object ko ek variable mein store karna
const globalForPrisma = global;

// Prisma instance banana ya purana reuse karna
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // log: ['query'], // Terminal mein SQL queries dekhne ke liye
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;