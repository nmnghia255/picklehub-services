-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('CANCELLATION_REFUND', 'BOOKING_PAYMENT', 'OWNER_MANUAL_ADJUST');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "credit_applied" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payment_remaining" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sport_centers" ADD COLUMN     "allow_cancellation" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "cancellation_tiers" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "min_days_before_start" INTEGER NOT NULL,
    "refund_percent" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cancellation_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_center_credits" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sport_center_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" UUID NOT NULL,
    "credit_id" UUID NOT NULL,
    "booking_id" UUID,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cancellation_tiers_center_id_idx" ON "cancellation_tiers"("center_id");

-- CreateIndex
CREATE UNIQUE INDEX "cancellation_tiers_center_id_min_days_before_start_key" ON "cancellation_tiers"("center_id", "min_days_before_start");

-- CreateIndex
CREATE INDEX "sport_center_credits_player_id_idx" ON "sport_center_credits"("player_id");

-- CreateIndex
CREATE INDEX "sport_center_credits_center_id_idx" ON "sport_center_credits"("center_id");

-- CreateIndex
CREATE UNIQUE INDEX "sport_center_credits_player_id_center_id_key" ON "sport_center_credits"("player_id", "center_id");

-- CreateIndex
CREATE INDEX "credit_transactions_credit_id_idx" ON "credit_transactions"("credit_id");

-- CreateIndex
CREATE INDEX "credit_transactions_booking_id_idx" ON "credit_transactions"("booking_id");

-- AddForeignKey
ALTER TABLE "cancellation_tiers" ADD CONSTRAINT "cancellation_tiers_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "sport_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_center_credits" ADD CONSTRAINT "sport_center_credits_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "sport_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "sport_center_credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
