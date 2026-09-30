/*
  Warnings:

  - You are about to drop the column `email` on the `group_guests` table. All the data in the column will be lost.
  - You are about to drop the column `gender` on the `group_guests` table. All the data in the column will be lost.
  - You are about to drop the column `invited_by_id` on the `group_guests` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `group_guests` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `group_guests` table. All the data in the column will be lost.
  - You are about to drop the column `skill_level` on the `group_guests` table. All the data in the column will be lost.
  - The `status` column on the `group_guests` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `group_guest_payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `group_guest_quota_requests` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `member_id` to the `group_guests` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GuestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "group_guest_payments" DROP CONSTRAINT "group_guest_payments_billed_to_id_fkey";

-- DropForeignKey
ALTER TABLE "group_guest_payments" DROP CONSTRAINT "group_guest_payments_expense_id_fkey";

-- DropForeignKey
ALTER TABLE "group_guest_payments" DROP CONSTRAINT "group_guest_payments_guest_id_fkey";

-- DropForeignKey
ALTER TABLE "group_guest_quota_requests" DROP CONSTRAINT "group_guest_quota_requests_group_id_fkey";

-- DropForeignKey
ALTER TABLE "group_guest_quota_requests" DROP CONSTRAINT "group_guest_quota_requests_member_id_fkey";

-- DropForeignKey
ALTER TABLE "group_guests" DROP CONSTRAINT "group_guests_invited_by_id_fkey";

-- DropIndex
DROP INDEX "group_guests_invited_by_id_idx";

-- AlterTable
ALTER TABLE "group_guests" DROP COLUMN "email",
DROP COLUMN "gender",
DROP COLUMN "name",
DROP COLUMN "phone",
DROP COLUMN "skill_level";

ALTER TABLE "group_guests" RENAME COLUMN "invited_by_id" TO "member_id";

ALTER TABLE "group_guests"
ADD COLUMN     "approved_at" TIMESTAMP(6),
ADD COLUMN     "approved_by_id" UUID,
ADD COLUMN     "guests_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "remaining_sessions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sessions_count" INTEGER NOT NULL DEFAULT 1,
DROP COLUMN "status",
ADD COLUMN     "status" "GuestStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- DropTable
DROP TABLE "group_guest_payments";

-- DropTable
DROP TABLE "group_guest_quota_requests";

-- DropEnum
DROP TYPE "GuestQuotaStatus";

-- CreateIndex
CREATE INDEX "group_guests_member_id_idx" ON "group_guests"("member_id");

-- CreateIndex
CREATE INDEX "group_guests_status_idx" ON "group_guests"("status");

-- AddForeignKey
ALTER TABLE "group_guests" ADD CONSTRAINT "group_guests_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
