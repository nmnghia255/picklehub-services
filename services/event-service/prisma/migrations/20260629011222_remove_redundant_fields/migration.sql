/*
  Warnings:

  - You are about to drop the column `price_per_player` on the `play_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `is_private` on the `socials` table. All the data in the column will be lost.
  - You are about to drop the column `max_slots` on the `socials` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "play_sessions" DROP COLUMN "price_per_player";

-- AlterTable
ALTER TABLE "socials" DROP COLUMN "is_private",
DROP COLUMN "max_slots";
