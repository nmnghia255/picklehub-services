-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'REJECTED', 'UNPAID');

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- CreateTable
CREATE TABLE "group_funds" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "deadline" TIMESTAMP(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "group_funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_payments" (
    "id" UUID NOT NULL,
    "fund_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_paid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "payment_receipt_url" TEXT,
    "verified_by" UUID,
    "paid_at" TIMESTAMP(6),

    CONSTRAINT "group_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_expenses" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "receipt_url" TEXT,
    "expense_date" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_funds_group_id_idx" ON "group_funds"("group_id");

-- CreateIndex
CREATE INDEX "group_payments_fund_id_idx" ON "group_payments"("fund_id");

-- CreateIndex
CREATE INDEX "group_payments_user_id_idx" ON "group_payments"("user_id");

-- CreateIndex
CREATE INDEX "group_payments_status_idx" ON "group_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "group_payments_fund_id_user_id_key" ON "group_payments"("fund_id", "user_id");

-- CreateIndex
CREATE INDEX "group_expenses_group_id_idx" ON "group_expenses"("group_id");

-- AddForeignKey
ALTER TABLE "group_funds" ADD CONSTRAINT "group_funds_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_payments" ADD CONSTRAINT "group_payments_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "group_funds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_expenses" ADD CONSTRAINT "group_expenses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
