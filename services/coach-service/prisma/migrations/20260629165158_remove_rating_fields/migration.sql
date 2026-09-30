/*
  Warnings:

  - You are about to drop the column `average_rating` on the `coach_profiles` table. All the data in the column will be lost.
  - You are about to drop the column `review_count` on the `coach_profiles` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "coach_profiles_average_rating_idx";

-- AlterTable
ALTER TABLE "coach_profiles" DROP COLUMN "average_rating",
DROP COLUMN "review_count";
