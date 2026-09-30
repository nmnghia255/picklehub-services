/*
  Warnings:

  - The values [PUBLISHED,COMPLETED] on the enum `PlaySessionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `allow_guests` on the `socials` table. All the data in the column will be lost.
  - You are about to drop the column `fee_mode` on the `socials` table. All the data in the column will be lost.
  - You are about to drop the column `fee_per_person` on the `socials` table. All the data in the column will be lost.
  - You are about to drop the column `total_fee` on the `socials` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `socials` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PlaySessionStatus_new" AS ENUM ('ACTIVE', 'CANCELLED');
ALTER TABLE "public"."play_sessions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "play_sessions" ALTER COLUMN "status" TYPE "PlaySessionStatus_new" USING ("status"::text::"PlaySessionStatus_new");
ALTER TYPE "PlaySessionStatus" RENAME TO "PlaySessionStatus_old";
ALTER TYPE "PlaySessionStatus_new" RENAME TO "PlaySessionStatus";
DROP TYPE "public"."PlaySessionStatus_old";
ALTER TABLE "play_sessions" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

-- DropIndex
DROP INDEX "socials_type_idx";

-- AlterTable
ALTER TABLE "play_sessions" ADD COLUMN     "booking_ids" TEXT[],
ADD COLUMN     "joined_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "session_fee" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "social_participants" ADD COLUMN     "is_host" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totalFee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "socials" DROP COLUMN "allow_guests",
DROP COLUMN "fee_mode",
DROP COLUMN "fee_per_person",
DROP COLUMN "total_fee",
DROP COLUMN "type",
ADD COLUMN     "discounted_package_fee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "has_available_slots" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_private" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "package_fee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_expense" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "start_time" DROP NOT NULL,
ALTER COLUMN "end_time" DROP NOT NULL;

-- DropEnum
DROP TYPE "SocialType";
