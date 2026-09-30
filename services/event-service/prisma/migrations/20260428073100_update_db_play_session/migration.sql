/*
  Warnings:

  - The values [JOINED,CANCELLED_BY_SYSTEM,PENDING,CHECKED_IN] on the enum `PlaySessionParticipantStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [SCHEDULED,IN_PROGRESS] on the enum `PlaySessionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `description` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `location_note` on the `play_sessions` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PlaySessionFormat" AS ENUM ('SOCIAL', 'SINGLES');

-- CreateEnum
CREATE TYPE "PlaySessionFeeMode" AS ENUM ('NONE', 'FREE', 'AUTO_SPLIT_TOTAL', 'PER_PERSON');

-- CreateEnum
CREATE TYPE "PlaySessionGenderPolicy" AS ENUM ('ANY', 'MALE_ONLY', 'FEMALE_ONLY', 'MIXED_ONLY');

-- CreateEnum
CREATE TYPE "PlaySessionAgeGroup" AS ENUM ('ANY', 'JUNIOR', 'ADULT', 'SENIOR');

-- CreateEnum
CREATE TYPE "PlaySessionHostRole" AS ENUM ('HOST_ONLY', 'HOST_AND_PLAY');

-- CreateEnum
CREATE TYPE "PlaySessionParticipantPaymentStatus" AS ENUM ('UNPAID', 'PENDING_REVIEW', 'PAID');

-- CreateEnum
CREATE TYPE "OrganizerRole" AS ENUM ('REFEREE', 'COACH', 'PAYMENT_COLLECTOR');

-- AlterEnum
BEGIN;
CREATE TYPE "PlaySessionParticipantStatus_new" AS ENUM ('CONFIRMED', 'WAITLISTED', 'ON_HOLD', 'CANCELLED');
ALTER TABLE "public"."play_session_participants" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "play_session_participants" ALTER COLUMN "status" TYPE "PlaySessionParticipantStatus_new" USING ("status"::text::"PlaySessionParticipantStatus_new");
ALTER TYPE "PlaySessionParticipantStatus" RENAME TO "PlaySessionParticipantStatus_old";
ALTER TYPE "PlaySessionParticipantStatus_new" RENAME TO "PlaySessionParticipantStatus";
DROP TYPE "public"."PlaySessionParticipantStatus_old";
ALTER TABLE "play_session_participants" ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PlaySessionStatus_new" AS ENUM ('PUBLISHED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."play_sessions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "play_sessions" ALTER COLUMN "status" TYPE "PlaySessionStatus_new" USING ("status"::text::"PlaySessionStatus_new");
ALTER TYPE "PlaySessionStatus" RENAME TO "PlaySessionStatus_old";
ALTER TYPE "PlaySessionStatus_new" RENAME TO "PlaySessionStatus";
DROP TYPE "public"."PlaySessionStatus_old";
ALTER TABLE "play_sessions" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED';
COMMIT;

-- AlterTable
ALTER TABLE "play_session_participants" ADD COLUMN     "payment_status" "PlaySessionParticipantPaymentStatus" NOT NULL DEFAULT 'UNPAID',
ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';

-- AlterTable
ALTER TABLE "play_sessions" DROP COLUMN "description",
DROP COLUMN "location_note",
ADD COLUMN     "age_group" "PlaySessionAgeGroup" NOT NULL DEFAULT 'ANY',
ADD COLUMN     "auto_approve_join_requests" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cancellation_freeze_hours" INTEGER,
ADD COLUMN     "fee_mode" "PlaySessionFeeMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "fee_per_person" INTEGER,
ADD COLUMN     "format" "PlaySessionFormat" NOT NULL DEFAULT 'SOCIAL',
ADD COLUMN     "gender_policy" "PlaySessionGenderPolicy" NOT NULL DEFAULT 'ANY',
ADD COLUMN     "host_role" "PlaySessionHostRole" NOT NULL DEFAULT 'HOST_AND_PLAY',
ADD COLUMN     "is_open_join" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maximum_level" DECIMAL(4,2),
ADD COLUMN     "minimum_level" DECIMAL(4,2),
ADD COLUMN     "note" TEXT,
ADD COLUMN     "repeat_rule" VARCHAR(120),
ADD COLUMN     "submit_dupr" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "total_fee" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'PUBLISHED',
ALTER COLUMN "allow_guests" SET DEFAULT false;

-- CreateTable
CREATE TABLE "PlaySessionOrganizer" (
    "play_session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "roles" "OrganizerRole"[],

    CONSTRAINT "PlaySessionOrganizer_pkey" PRIMARY KEY ("play_session_id","user_id")
);

-- CreateIndex
CREATE INDEX "PlaySessionOrganizer_user_id_idx" ON "PlaySessionOrganizer"("user_id");

-- CreateIndex
CREATE INDEX "play_sessions_format_idx" ON "play_sessions"("format");

-- CreateIndex
CREATE INDEX "play_sessions_is_open_join_idx" ON "play_sessions"("is_open_join");

-- AddForeignKey
ALTER TABLE "PlaySessionOrganizer" ADD CONSTRAINT "PlaySessionOrganizer_play_session_id_fkey" FOREIGN KEY ("play_session_id") REFERENCES "play_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
