-- CreateTable
CREATE TABLE "private_bookings" (
    "id" UUID NOT NULL,
    "coach_profile_id" UUID NOT NULL,
    "learner_id" UUID NOT NULL,
    "requested_at" TIMESTAMP(6) NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "price_vnd" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING_PROOF',
    "learner_note" TEXT,
    "coach_note" TEXT,
    "cancel_reason" TEXT,
    "payment_proof_url" VARCHAR(500),
    "proof_uploaded_at" TIMESTAMP(6),
    "settled_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "private_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "private_bookings_coach_profile_id_idx" ON "private_bookings"("coach_profile_id");

-- CreateIndex
CREATE INDEX "private_bookings_learner_id_idx" ON "private_bookings"("learner_id");

-- CreateIndex
CREATE INDEX "private_bookings_status_idx" ON "private_bookings"("status");

-- CreateIndex
CREATE INDEX "private_bookings_requested_at_idx" ON "private_bookings"("requested_at");

-- AddForeignKey
ALTER TABLE "private_bookings" ADD CONSTRAINT "private_bookings_coach_profile_id_fkey" FOREIGN KEY ("coach_profile_id") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
