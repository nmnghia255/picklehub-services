/*
  Warnings:

  - You are about to drop the column `rating_host` on the `social_feedbacks` table. All the data in the column will be lost.
  - You are about to drop the column `rating_matchmaking` on the `social_feedbacks` table. All the data in the column will be lost.
  - Added the required column `rating_organization` to the `social_feedbacks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rating_overall` to the `social_feedbacks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "social_feedbacks" RENAME COLUMN "rating_host" TO "rating_overall";
ALTER TABLE "social_feedbacks" RENAME COLUMN "rating_matchmaking" TO "rating_organization";
