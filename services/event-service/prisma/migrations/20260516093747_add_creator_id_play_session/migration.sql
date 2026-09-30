/*
  Warnings:

  - Added the required column `creator_id` to the `play_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "play_sessions" ADD COLUMN "creator_id" UUID NOT NULL;
