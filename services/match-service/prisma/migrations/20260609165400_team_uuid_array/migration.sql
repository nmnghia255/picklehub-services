/*
  Warnings:

  - The `team_a` column on the `matches` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `team_b` column on the `matches` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "matches" DROP COLUMN "team_a",
ADD COLUMN     "team_a" UUID[],
DROP COLUMN "team_b",
ADD COLUMN     "team_b" UUID[];
