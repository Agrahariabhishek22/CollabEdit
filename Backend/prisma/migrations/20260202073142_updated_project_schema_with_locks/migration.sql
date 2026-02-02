-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "isBranchLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockAcquiredAt" TIMESTAMP(3);
