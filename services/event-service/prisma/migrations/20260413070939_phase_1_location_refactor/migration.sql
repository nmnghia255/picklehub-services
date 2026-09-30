/*
  Warnings:

  - You are about to drop the column `court_booking_id` on the `play_sessions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "play_sessions" DROP COLUMN "court_booking_id",
ADD COLUMN     "court_names" VARCHAR(100),
ADD COLUMN     "location_note" TEXT,
ADD COLUMN     "number_of_courts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sport_center_id" UUID;
