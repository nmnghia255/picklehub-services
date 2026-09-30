/*
  Warnings:

  - The values [PENDING,REJECTED] on the enum `PaymentStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `amount` on the `group_expenses` table. All the data in the column will be lost.
  - You are about to drop the column `credit_used` on the `group_payments` table. All the data in the column will be lost.
  - You are about to drop the column `fund_id` on the `group_payments` table. All the data in the column will be lost.
  - You are about to drop the column `payment_receipt_url` on the `group_payments` table. All the data in the column will be lost.
  - You are about to drop the column `required_amount` on the `group_payments` table. All the data in the column will be lost.
  - You are about to drop the `group_funds` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[expense_id,user_id]` on the table `group_payments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `total_amount` to the `group_expenses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `group_expenses` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expense_id` to the `group_payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `required_fee` to the `group_payments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `group_payments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING_REVIEW', 'VERIFIED', 'REJECTED');

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('UNPAID', 'PENDING_REVIEW', 'PAID', 'PARTIALLY_PAID', 'OVERPAID');
ALTER TABLE "public"."group_payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "group_payments" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING (
  CASE 
    WHEN "status"::text = 'PENDING' THEN 'PENDING_REVIEW'::text::"PaymentStatus_new"
    WHEN "status"::text = 'REJECTED' THEN 'UNPAID'::text::"PaymentStatus_new"
    ELSE "status"::text::"PaymentStatus_new"
  END
);
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "group_payments" ALTER COLUMN "status" SET DEFAULT 'UNPAID';
COMMIT;

-- DropForeignKey
ALTER TABLE "group_funds" DROP CONSTRAINT "group_funds_group_id_fkey";

-- DropForeignKey
ALTER TABLE "group_payments" DROP CONSTRAINT "group_payments_fund_id_fkey";

-- DropIndex
DROP INDEX "group_payments_fund_id_idx";

-- DropIndex
DROP INDEX "group_payments_fund_id_user_id_key";

-- AlterTable
ALTER TABLE "group_expenses" 
RENAME COLUMN "amount" TO "total_amount";

ALTER TABLE "group_expenses"
ADD COLUMN "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- BACKFILL: Migrate group_funds to group_expenses before dropping group_funds
INSERT INTO "group_expenses" ("id", "group_id", "title", "description", "total_amount", "expense_date", "created_by", "created_at", "updated_at")
SELECT "id", "group_id", "title", "description", "required_amount", COALESCE("deadline", "created_at"), "created_by", "created_at", "updated_at"
FROM "group_funds";

-- AlterTable
ALTER TABLE "group_payments" 
RENAME COLUMN "fund_id" TO "expense_id";

ALTER TABLE "group_payments"
RENAME COLUMN "required_amount" TO "required_fee";

ALTER TABLE "group_payments" DROP COLUMN "credit_used",
DROP COLUMN "payment_receipt_url",
ADD COLUMN     "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- DropTable
DROP TABLE "group_funds";

-- CreateTable
CREATE TABLE "group_transactions" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "receipt_url" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "verified_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "group_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_transactions_group_id_user_id_idx" ON "group_transactions"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "group_transactions_status_idx" ON "group_transactions"("status");

-- CreateIndex
CREATE INDEX "group_payments_expense_id_idx" ON "group_payments"("expense_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_payments_expense_id_user_id_key" ON "group_payments"("expense_id", "user_id");

-- AddForeignKey
ALTER TABLE "group_payments" ADD CONSTRAINT "group_payments_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "group_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_transactions" ADD CONSTRAINT "group_transactions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
