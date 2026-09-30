-- CreateEnum
CREATE TYPE "GuestQuotaStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "group_payments" ADD COLUMN     "guest_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "guest_fee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- CreateTable
CREATE TABLE "group_guest_quota_requests" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "guests_count" INTEGER NOT NULL,
    "sessions_count" INTEGER NOT NULL,
    "remaining_sessions" INTEGER NOT NULL DEFAULT 0,
    "status" "GuestQuotaStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "group_guest_quota_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_guest_quota_requests_group_id_idx" ON "group_guest_quota_requests"("group_id");

-- CreateIndex
CREATE INDEX "group_guest_quota_requests_member_id_idx" ON "group_guest_quota_requests"("member_id");

-- CreateIndex
CREATE INDEX "group_guest_quota_requests_status_idx" ON "group_guest_quota_requests"("status");

-- AddForeignKey
ALTER TABLE "group_guest_quota_requests" ADD CONSTRAINT "group_guest_quota_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_guest_quota_requests" ADD CONSTRAINT "group_guest_quota_requests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
