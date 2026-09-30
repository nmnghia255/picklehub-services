-- Alter booking cancel reason from Prisma enum to plain text.
ALTER TABLE "bookings"
  ALTER COLUMN "cancel_reason" TYPE TEXT
  USING "cancel_reason"::text;

DROP TYPE IF EXISTS "BookingCancelReason";
