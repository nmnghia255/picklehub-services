-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'GRACE_PERIOD', 'FROZEN', 'ARCHIVED');

-- AlterTable
ALTER TABLE "groups"
ADD COLUMN "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "groups_status_idx" ON "groups"("status");
