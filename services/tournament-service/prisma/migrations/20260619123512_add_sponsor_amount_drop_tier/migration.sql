/*
  Warnings:

  - You are about to drop the column `tier` on the `Sponsor` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Sponsor" DROP COLUMN "tier",
ADD COLUMN     "amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
