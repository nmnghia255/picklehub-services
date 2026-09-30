/*
  Warnings:

  - You are about to drop the column `format` on the `TournamentEvent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TournamentEvent" DROP COLUMN "format";

-- DropEnum
DROP TYPE "EventFormat";
