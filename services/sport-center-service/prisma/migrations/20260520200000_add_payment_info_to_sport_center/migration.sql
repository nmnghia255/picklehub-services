-- Migration: add_payment_info_to_sport_center
-- Adds bank transfer details and QR code URL to sport_centers
-- so that players can see how to pay after booking.

ALTER TABLE "sport_centers"
  ADD COLUMN "payment_account_name"   VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN "payment_account_number" VARCHAR(50)  NOT NULL DEFAULT '',
  ADD COLUMN "payment_bank_name"      VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN "payment_qr_url"         VARCHAR(500);

-- Remove the DEFAULT after backfill so new rows are always explicit.
ALTER TABLE "sport_centers"
  ALTER COLUMN "payment_account_name"   DROP DEFAULT,
  ALTER COLUMN "payment_account_number" DROP DEFAULT,
  ALTER COLUMN "payment_bank_name"      DROP DEFAULT;
