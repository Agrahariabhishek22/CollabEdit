/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "GitStatus" AS ENUM ('UNTRACKED', 'MODIFIED', 'STAGED', 'COMMITTED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('LOCAL', 'GIT', 'UI_CREATED');

-- CreateEnum
CREATE TYPE "OpType" AS ENUM ('STRUCTURAL_CHANGE', 'LOGIC_UPDATE', 'CONFLICT');

-- CreateEnum
CREATE TYPE "NotifType" AS ENUM ('INVITE', 'REVOKE', 'CONFLICT_ALERT');

-- CreateEnum
CREATE TYPE "NotifStatus" AS ENUM ('PENDING', 'ACCEPTED', 'READ');

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ADD COLUMN     "accessibleProjectIds" TEXT[],
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "password" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "name" SET NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rootPath" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL DEFAULT 'UI_CREATED',
    "remoteUrl" TEXT,
    "currentBranch" TEXT NOT NULL DEFAULT 'main',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileMeta" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "extension" TEXT,
    "isFolder" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "absolutePath" TEXT NOT NULL,
    "parentId" TEXT,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitContext" (
    "id" TEXT NOT NULL,
    "fileMetaId" TEXT NOT NULL,
    "status" "GitStatus" NOT NULL DEFAULT 'UNTRACKED',
    "isIgnored" BOOLEAN NOT NULL DEFAULT false,
    "isConflicted" BOOLEAN NOT NULL DEFAULT false,
    "lastCommitHash" TEXT,
    "lastCommitMsg" TEXT,

    CONSTRAINT "GitContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorState" (
    "id" TEXT NOT NULL,
    "fileMetaId" TEXT NOT NULL,
    "content" TEXT,
    "binaryText" BYTEA,

    CONSTRAINT "EditorState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaboratorDetail" (
    "id" TEXT NOT NULL,
    "fileMetaId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "editors" TEXT[],
    "viewers" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaboratorDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "fileMetaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opType" "OpType" NOT NULL,
    "summary" TEXT,
    "diffPatch" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checkpoint" (
    "id" TEXT NOT NULL,
    "fileMetaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT,
    "binaryText" BYTEA,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "type" "NotifType" NOT NULL,
    "status" "NotifStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileMeta_absolutePath_key" ON "FileMeta"("absolutePath");

-- CreateIndex
CREATE UNIQUE INDEX "GitContext_fileMetaId_key" ON "GitContext"("fileMetaId");

-- CreateIndex
CREATE UNIQUE INDEX "EditorState_fileMetaId_key" ON "EditorState"("fileMetaId");

-- CreateIndex
CREATE UNIQUE INDEX "CollaboratorDetail_fileMetaId_key" ON "CollaboratorDetail"("fileMetaId");

-- CreateIndex
CREATE UNIQUE INDEX "Checkpoint_fileMetaId_userId_key" ON "Checkpoint"("fileMetaId", "userId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileMeta" ADD CONSTRAINT "FileMeta_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileMeta" ADD CONSTRAINT "FileMeta_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FileMeta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitContext" ADD CONSTRAINT "GitContext_fileMetaId_fkey" FOREIGN KEY ("fileMetaId") REFERENCES "FileMeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorState" ADD CONSTRAINT "EditorState_fileMetaId_fkey" FOREIGN KEY ("fileMetaId") REFERENCES "FileMeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaboratorDetail" ADD CONSTRAINT "CollaboratorDetail_fileMetaId_fkey" FOREIGN KEY ("fileMetaId") REFERENCES "FileMeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_fileMetaId_fkey" FOREIGN KEY ("fileMetaId") REFERENCES "FileMeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkpoint" ADD CONSTRAINT "Checkpoint_fileMetaId_fkey" FOREIGN KEY ("fileMetaId") REFERENCES "FileMeta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkpoint" ADD CONSTRAINT "Checkpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
