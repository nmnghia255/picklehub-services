/*
  Warnings:

  - You are about to drop the column `group_id` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `matches` table. All the data in the column will be lost.
  - You are about to drop the `score_updates` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `court_id` on table `matches` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `team_a` on the `matches` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `team_b` on the `matches` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "MatchCategory" AS ENUM ('SOCIAL', 'TOURNAMENT', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "score_updates" DROP CONSTRAINT "score_updates_match_id_fkey";

-- DropIndex
DROP INDEX "matches_group_id_idx";

-- AlterTable
ALTER TABLE "matches" DROP COLUMN "group_id",
DROP COLUMN "location",
ADD COLUMN     "category" "MatchCategory" NOT NULL DEFAULT 'CUSTOM',
ADD COLUMN     "play_session_id" UUID,
ALTER COLUMN "match_type" SET DEFAULT 'PRACTICE';

-- Data Backfill: Set a valid court UUID (e.g., from sport-center-service seed 'Court A' of Center 1)
UPDATE "matches" SET "court_id" = 'c0010000-c001-4000-8000-000000010001' WHERE "court_id" IS NULL;

ALTER TABLE "matches" ALTER COLUMN "court_id" SET NOT NULL;

-- Data Backfill: Safely cast the existing UUID arrays to JSONB arrays
ALTER TABLE "matches" 
  ALTER COLUMN "team_a" TYPE JSONB USING to_jsonb("team_a"),
  ALTER COLUMN "team_b" TYPE JSONB USING to_jsonb("team_b");

-- DropTable
DROP TABLE "score_updates";

-- CreateIndex
CREATE INDEX "matches_court_id_idx" ON "matches"("court_id");

-- CreateIndex
CREATE INDEX "matches_play_session_id_idx" ON "matches"("play_session_id");
