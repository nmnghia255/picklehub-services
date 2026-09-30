-- Migration: add_payment_proof_to_booking
-- Adds payment proof URL and upload timestamp to bookings
-- so players can upload their bank transfer screenshot for owner review.

ALTER TABLE "bookings"
  ADD COLUMN "payment_proof_url"         VARCHAR(500),
  ADD COLUMN "payment_proof_uploaded_at" TIMESTAMP(6);
