/*
  Warnings:

  - A unique constraint covering the columns `[rootFileMetaId]` on the table `Project` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "rootFileMetaId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Project_rootFileMetaId_key" ON "Project"("rootFileMetaId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_rootFileMetaId_fkey" FOREIGN KEY ("rootFileMetaId") REFERENCES "FileMeta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
