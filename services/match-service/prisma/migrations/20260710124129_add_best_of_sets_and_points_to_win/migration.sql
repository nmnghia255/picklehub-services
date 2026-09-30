-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "best_of_sets" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "points_to_win" INTEGER NOT NULL DEFAULT 11;
