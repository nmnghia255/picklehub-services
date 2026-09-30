/*
  Warnings:

  - You are about to drop the column `groupStageStatus` on the `TournamentEvent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TournamentEvent" DROP COLUMN "groupStageStatus",
ALTER COLUMN "groupStageEnabled" SET DEFAULT true;
