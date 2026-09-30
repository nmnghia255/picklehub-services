/*
  Warnings:

  - You are about to alter the column `amount` on the `group_expenses` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - You are about to drop the column `amount` on the `group_funds` table. All the data in the column will be lost.
  - You are about to alter the column `amount_paid` on the `group_payments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Integer`.
  - Added the required column `required_amount` to the `group_funds` table without a default value. This is not possible if the table is not empty.
  - Added the required column `required_amount` to the `group_payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "group_expenses"
ALTER COLUMN "amount" SET DEFAULT 0,
ALTER COLUMN "amount" SET DATA TYPE INTEGER USING ROUND("amount")::INTEGER;

-- AlterTable
ALTER TABLE "group_funds"
ADD COLUMN     "required_amount" INTEGER DEFAULT 0;

UPDATE "group_funds"
SET "required_amount" = COALESCE(ROUND("amount")::INTEGER, 0);

ALTER TABLE "group_funds"
ALTER COLUMN "required_amount" SET NOT NULL,
DROP COLUMN "amount";

-- AlterTable
ALTER TABLE "group_members" ADD COLUMN     "credit_balance" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "group_payments"
ADD COLUMN     "credit_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "required_amount" INTEGER DEFAULT 0,
ALTER COLUMN "amount_paid" SET DEFAULT 0,
ALTER COLUMN "amount_paid" SET DATA TYPE INTEGER USING ROUND("amount_paid")::INTEGER;

UPDATE "group_payments"
SET "required_amount" = COALESCE("required_amount", "amount_paid", 0);

ALTER TABLE "group_payments"
ALTER COLUMN "required_amount" SET NOT NULL;

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';
