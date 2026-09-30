/*
  Warnings:

  - You are about to drop the `group_guests` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "group_guests" DROP CONSTRAINT "group_guests_group_id_fkey";

-- DropForeignKey
ALTER TABLE "group_guests" DROP CONSTRAINT "group_guests_member_id_fkey";

-- AlterTable
ALTER TABLE "group_activities" ADD COLUMN     "cancellation_deadline_hours" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "court_booking_id" UUID;

-- AlterTable
ALTER TABLE "group_expenses" ADD COLUMN     "activity_id" UUID;

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- DropTable
DROP TABLE "group_guests";

-- DropEnum
DROP TYPE "GuestStatus";

-- CreateTable
CREATE TABLE "session_attendances" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ATTENDING',
    "guest_count" INTEGER NOT NULL DEFAULT 0,
    "guest_status" VARCHAR(50),
    "reported_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "session_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_attendances_activity_id_idx" ON "session_attendances"("activity_id");

-- CreateIndex
CREATE INDEX "session_attendances_member_id_idx" ON "session_attendances"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_attendances_activity_id_member_id_key" ON "session_attendances"("activity_id", "member_id");

-- CreateIndex
CREATE INDEX "group_activities_court_booking_id_idx" ON "group_activities"("court_booking_id");

-- CreateIndex
CREATE INDEX "group_expenses_activity_id_idx" ON "group_expenses"("activity_id");

-- AddForeignKey
ALTER TABLE "group_expenses" ADD CONSTRAINT "group_expenses_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "group_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_activities" ADD CONSTRAINT "group_activities_court_booking_id_fkey" FOREIGN KEY ("court_booking_id") REFERENCES "group_court_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_attendances" ADD CONSTRAINT "session_attendances_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "group_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_attendances" ADD CONSTRAINT "session_attendances_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "group_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
