/*
  Warnings:

  - The values [REJECTED] on the enum `NotifStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [INVITE,REVOKE,CONFLICT_ALERT] on the enum `NotifType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotifStatus_new" AS ENUM ('PENDING', 'READ', 'ACCEPTED', 'DECLINED');
ALTER TABLE "public"."Notification" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Notification" ALTER COLUMN "status" TYPE "NotifStatus_new" USING ("status"::text::"NotifStatus_new");
ALTER TYPE "NotifStatus" RENAME TO "NotifStatus_old";
ALTER TYPE "NotifStatus_new" RENAME TO "NotifStatus";
DROP TYPE "public"."NotifStatus_old";
ALTER TABLE "Notification" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "NotifType_new" AS ENUM ('INVITE_RECEIVED', 'INVITE_DECLINED', 'ACCESS_REVOKED', 'ACCESS_UPGRADED', 'ACCESS_DOWNGRADED', 'COLLAB_JOINED');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotifType_new" USING ("type"::text::"NotifType_new");
ALTER TYPE "NotifType" RENAME TO "NotifType_old";
ALTER TYPE "NotifType_new" RENAME TO "NotifType";
DROP TYPE "public"."NotifType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "actionMode" TEXT,
ADD COLUMN     "isRevoked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "oldMode" TEXT,
ADD COLUMN     "resourceId" TEXT,
ADD COLUMN     "resourceName" TEXT,
ADD COLUMN     "resourceType" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3);
