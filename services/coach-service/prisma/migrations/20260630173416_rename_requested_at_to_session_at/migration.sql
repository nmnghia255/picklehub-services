-- Rename requested_at → session_at on private_bookings
-- Preserves all existing data (no add/drop, just a rename)
ALTER TABLE "private_bookings" RENAME COLUMN "requested_at" TO "session_at";
