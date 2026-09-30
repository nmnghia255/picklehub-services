/*
  Warnings:

  - You are about to drop the column `guest_name` on the `play_session_participants` table. All the data in the column will be lost.
  - You are about to drop the column `is_guest` on the `play_session_participants` table. All the data in the column will be lost.
  - You are about to drop the column `skill_level` on the `play_session_participants` table. All the data in the column will be lost.
  - You are about to drop the column `payment_receipt_url` on the `social_participants` table. All the data in the column will be lost.
  - The `payment_status` column on the `social_participants` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `discounted_package_fee` on the `socials` table. All the data in the column will be lost.
  - You are about to drop the column `group_id` on the `socials` table. All the data in the column will be lost.
  - You are about to drop the column `payment_code` on the `socials` table. All the data in the column will be lost.
  - You are about to drop the `social_organizers` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ParticipantPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERPAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SocialTransactionType" AS ENUM ('PAYMENT', 'REFUND');

-- DropForeignKey
ALTER TABLE "social_organizers" DROP CONSTRAINT "social_organizers_social_id_fkey";

-- DropIndex
DROP INDEX "socials_group_id_idx";

-- AlterTable
ALTER TABLE "play_session_participants" DROP COLUMN "guest_name",
DROP COLUMN "is_guest",
DROP COLUMN "skill_level";

-- AlterTable
ALTER TABLE "play_sessions" ADD COLUMN     "center_id" UUID,
ADD COLUMN     "center_name" VARCHAR(255),
ADD COLUMN     "court_schedule" JSONB,
ADD COLUMN     "price_per_player" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "social_participants" DROP COLUMN "payment_receipt_url",
ADD COLUMN     "amount_paid" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "amount_refunded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_full_package" BOOLEAN NOT NULL DEFAULT true,
DROP COLUMN "payment_status",
ADD COLUMN     "payment_status" "ParticipantPaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- AlterTable
ALTER TABLE "socials" DROP COLUMN "discounted_package_fee",
DROP COLUMN "group_id",
DROP COLUMN "payment_code",
ADD COLUMN     "is_free" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payment_account_name" VARCHAR(100),
ADD COLUMN     "payment_account_number" VARCHAR(50),
ADD COLUMN     "payment_bank_name" VARCHAR(100),
ADD COLUMN     "total_booking_cost" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "package_fee" DROP NOT NULL,
ALTER COLUMN "package_fee" DROP DEFAULT;

-- DropTable
DROP TABLE "social_organizers";

-- DropEnum
DROP TYPE "OrganizerRole";

-- DropEnum
DROP TYPE "SocialPaymentStatus";

-- CreateTable
CREATE TABLE "social_payments" (
    "id" UUID NOT NULL,
    "social_participant_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "receipt_url" TEXT,
    "transaction_type" "SocialTransactionType" NOT NULL DEFAULT 'PAYMENT',
    "created_by" UUID NOT NULL,
    "verified_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "social_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_expenses" (
    "id" UUID NOT NULL,
    "social_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "receipt_url" TEXT,
    "expense_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_payments_social_participant_id_idx" ON "social_payments"("social_participant_id");

-- CreateIndex
CREATE INDEX "social_expenses_social_id_idx" ON "social_expenses"("social_id");

-- AddForeignKey
ALTER TABLE "social_payments" ADD CONSTRAINT "social_payments_social_participant_id_fkey" FOREIGN KEY ("social_participant_id") REFERENCES "social_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_expenses" ADD CONSTRAINT "social_expenses_social_id_fkey" FOREIGN KEY ("social_id") REFERENCES "socials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
