-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING_REVIEW', 'SETTLED', 'REJECTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH');

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "proof_url" VARCHAR(500),
    "received_at" TIMESTAMP(6),
    "reviewed_at" TIMESTAMP(6),
    "rejected_at" TIMESTAMP(6),
    "rejected_reason" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_booking_id_key" ON "payment_transactions"("booking_id");

-- CreateIndex
CREATE INDEX "payment_transactions_center_id_idx" ON "payment_transactions"("center_id");

-- CreateIndex
CREATE INDEX "payment_transactions_player_id_idx" ON "payment_transactions"("player_id");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");

-- CreateIndex
CREATE INDEX "payment_transactions_created_at_idx" ON "payment_transactions"("created_at");

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "sport_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;