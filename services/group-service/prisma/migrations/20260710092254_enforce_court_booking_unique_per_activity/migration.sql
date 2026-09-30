/*
  Warnings:

  - A unique constraint covering the columns `[court_booking_id]` on the table `group_activities` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX IF EXISTS "group_activities_court_booking_id_idx";

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- Backfill: Set duplicate court_booking_id to NULL, keeping only the newest activity per court_booking_id
UPDATE "group_activities"
SET "court_booking_id" = NULL
WHERE "id" NOT IN (
  SELECT "id"
  FROM (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "court_booking_id" ORDER BY "start_at" DESC, "created_at" DESC) as row_num
    FROM "group_activities"
    WHERE "court_booking_id" IS NOT NULL
  ) t
  WHERE t.row_num = 1
);

-- CreateIndex
CREATE UNIQUE INDEX "group_activities_court_booking_id_key" ON "group_activities"("court_booking_id");
