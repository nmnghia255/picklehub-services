/*
  Warnings:

  - You are about to drop the column `guests_count` on the `play_session_participants` table. All the data in the column will be lost.
  - You are about to drop the column `is_checked_in` on the `play_session_participants` table. All the data in the column will be lost.
  - You are about to drop the column `payment_receipt_url` on the `play_session_participants` table. All the data in the column will be lost.
  - You are about to drop the column `payment_status` on the `play_session_participants` table. All the data in the column will be lost.
  - You are about to drop the column `age_group` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `allow_guests` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `auto_approve_join_requests` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `cancellation_freeze_hours` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `creator_id` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `fee` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `fee_mode` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `fee_per_person` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `format` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `gender_policy` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `group_id` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `host_role` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `is_open_join` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `joined_count` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `max_slots` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `maximum_level` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `minimum_level` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `payment_code` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `payment_note` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `payment_qr_url` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `repeat_rule` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `sport_center_id` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `submit_dupr` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `total_fee` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to alter the column `location` on the `play_sessions` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(200)`.
  - You are about to drop the `PlaySessionOrganizer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `play_session_guests` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `social_id` to the `play_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SocialType" AS ENUM ('PUBLIC_APP', 'INTERNAL_GROUP');

-- CreateEnum
CREATE TYPE "SocialFormat" AS ENUM ('SOCIAL', 'SINGLES');

-- CreateEnum
CREATE TYPE "SocialFeeMode" AS ENUM ('NONE', 'FREE', 'AUTO_SPLIT_TOTAL', 'PER_PERSON');

-- CreateEnum
CREATE TYPE "SocialGenderPolicy" AS ENUM ('ANY', 'MALE_ONLY', 'FEMALE_ONLY', 'MIXED_ONLY');

-- CreateEnum
CREATE TYPE "SocialAgeGroup" AS ENUM ('ANY', 'JUNIOR', 'ADULT', 'SENIOR');

-- CreateEnum
CREATE TYPE "SocialHostRole" AS ENUM ('HOST_ONLY', 'HOST_AND_PLAY');

-- CreateEnum
CREATE TYPE "SocialStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SocialParticipantStatus" AS ENUM ('CONFIRMED', 'WAITLISTED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SocialPaymentStatus" AS ENUM ('UNPAID', 'PENDING_REVIEW', 'PAID');

-- DropForeignKey
ALTER TABLE "PlaySessionOrganizer" DROP CONSTRAINT "PlaySessionOrganizer_play_session_id_fkey";

-- DropForeignKey
ALTER TABLE "play_session_guests" DROP CONSTRAINT "play_session_guests_play_session_id_fkey";

-- DropIndex
DROP INDEX "play_sessions_format_idx";

-- DropIndex
DROP INDEX "play_sessions_group_id_idx";

-- DropIndex
DROP INDEX "play_sessions_is_open_join_idx";

-- DropIndex
DROP INDEX "play_sessions_type_idx";

-- AlterTable
ALTER TABLE "play_session_participants" DROP COLUMN "guests_count",
DROP COLUMN "is_checked_in",
DROP COLUMN "payment_receipt_url",
DROP COLUMN "payment_status";

-- AlterTable
ALTER TABLE "play_sessions" DROP COLUMN "age_group",
DROP COLUMN "allow_guests",
DROP COLUMN "auto_approve_join_requests",
DROP COLUMN "cancellation_freeze_hours",
DROP COLUMN "creator_id",
DROP COLUMN "fee",
DROP COLUMN "fee_mode",
DROP COLUMN "fee_per_person",
DROP COLUMN "format",
DROP COLUMN "gender_policy",
DROP COLUMN "group_id",
DROP COLUMN "host_role",
DROP COLUMN "is_open_join",
DROP COLUMN "joined_count",
DROP COLUMN "max_slots",
DROP COLUMN "maximum_level",
DROP COLUMN "minimum_level",
DROP COLUMN "note",
DROP COLUMN "payment_code",
DROP COLUMN "payment_note",
DROP COLUMN "payment_qr_url",
DROP COLUMN "repeat_rule",
DROP COLUMN "sport_center_id",
DROP COLUMN "submit_dupr",
DROP COLUMN "total_fee",
DROP COLUMN "type",
ADD COLUMN     "social_id" UUID NOT NULL,
ALTER COLUMN "location" SET DATA TYPE VARCHAR(200);

-- DropTable
DROP TABLE "PlaySessionOrganizer";

-- DropTable
DROP TABLE "play_session_guests";

-- DropEnum
DROP TYPE "PlaySessionAgeGroup";

-- DropEnum
DROP TYPE "PlaySessionFeeMode";

-- DropEnum
DROP TYPE "PlaySessionFormat";

-- DropEnum
DROP TYPE "PlaySessionGenderPolicy";

-- DropEnum
DROP TYPE "PlaySessionGuestStatus";

-- DropEnum
DROP TYPE "PlaySessionGuestType";

-- DropEnum
DROP TYPE "PlaySessionHostRole";

-- DropEnum
DROP TYPE "PlaySessionParticipantPaymentStatus";

-- DropEnum
DROP TYPE "PlaySessionType";

-- CreateTable
CREATE TABLE "socials" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "note" TEXT,
    "type" "SocialType" NOT NULL,
    "start_time" TIMESTAMP(6) NOT NULL,
    "end_time" TIMESTAMP(6) NOT NULL,
    "fee_mode" "SocialFeeMode" NOT NULL DEFAULT 'NONE',
    "total_fee" INTEGER,
    "fee_per_person" INTEGER,
    "format" "SocialFormat" NOT NULL DEFAULT 'SOCIAL',
    "allow_guests" BOOLEAN NOT NULL DEFAULT false,
    "auto_approve_join_requests" BOOLEAN NOT NULL DEFAULT false,
    "submit_dupr" BOOLEAN NOT NULL DEFAULT false,
    "minimum_level" DECIMAL(4,2),
    "maximum_level" DECIMAL(4,2),
    "gender_policy" "SocialGenderPolicy" NOT NULL DEFAULT 'ANY',
    "age_group" "SocialAgeGroup" NOT NULL DEFAULT 'ANY',
    "host_role" "SocialHostRole" NOT NULL DEFAULT 'HOST_AND_PLAY',
    "cancellation_freeze_hours" INTEGER,
    "group_id" UUID,
    "payment_qr_url" VARCHAR(500),
    "payment_code" VARCHAR(120),
    "payment_note" VARCHAR(500),
    "max_slots" INTEGER NOT NULL,
    "joined_count" INTEGER NOT NULL DEFAULT 0,
    "status" "SocialStatus" NOT NULL DEFAULT 'PUBLISHED',
    "creator_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "socials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_participants" (
    "id" UUID NOT NULL,
    "social_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "SocialParticipantStatus" NOT NULL DEFAULT 'CONFIRMED',
    "payment_receipt_url" VARCHAR(500),
    "payment_status" "SocialPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "joined_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_organizers" (
    "social_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "roles" "OrganizerRole"[],

    CONSTRAINT "social_organizers_pkey" PRIMARY KEY ("social_id","user_id")
);

-- CreateIndex
CREATE INDEX "socials_group_id_idx" ON "socials"("group_id");

-- CreateIndex
CREATE INDEX "socials_type_idx" ON "socials"("type");

-- CreateIndex
CREATE INDEX "socials_format_idx" ON "socials"("format");

-- CreateIndex
CREATE INDEX "socials_status_idx" ON "socials"("status");

-- CreateIndex
CREATE INDEX "social_participants_user_id_idx" ON "social_participants"("user_id");

-- CreateIndex
CREATE INDEX "social_participants_social_id_status_joined_at_idx" ON "social_participants"("social_id", "status", "joined_at");

-- CreateIndex
CREATE UNIQUE INDEX "social_participants_social_id_user_id_key" ON "social_participants"("social_id", "user_id");

-- CreateIndex
CREATE INDEX "social_organizers_user_id_idx" ON "social_organizers"("user_id");

-- CreateIndex
CREATE INDEX "play_sessions_social_id_idx" ON "play_sessions"("social_id");

-- AddForeignKey
ALTER TABLE "social_participants" ADD CONSTRAINT "social_participants_social_id_fkey" FOREIGN KEY ("social_id") REFERENCES "socials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_organizers" ADD CONSTRAINT "social_organizers_social_id_fkey" FOREIGN KEY ("social_id") REFERENCES "socials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_social_id_fkey" FOREIGN KEY ("social_id") REFERENCES "socials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
