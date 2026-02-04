-- CreateTable
CREATE TABLE "ProjectLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "fileMetaId" TEXT,
    "fileName" TEXT,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectLog_projectId_timestamp_idx" ON "ProjectLog"("projectId", "timestamp");

-- CreateIndex
CREATE INDEX "ProjectLog_userId_idx" ON "ProjectLog"("userId");

-- AddForeignKey
ALTER TABLE "ProjectLog" ADD CONSTRAINT "ProjectLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLog" ADD CONSTRAINT "ProjectLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
