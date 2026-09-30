-- Add court-link location fields to class_schedules
-- Dual-mode location: per-session free-text override OR linked sport-center court booking.
-- All fields are nullable — existing rows unaffected.
ALTER TABLE "class_schedules"
  ADD COLUMN "location_description" VARCHAR(300),
  ADD COLUMN "court_booking_id"     UUID,
  ADD COLUMN "court_id"             UUID,
  ADD COLUMN "court_cost_vnd"       INTEGER;

-- Add court-link location fields to private_bookings
-- Same dual-mode design as class_schedules.
-- courtCostVnd is snapshotted from the sport-center booking.totalPrice at creation time.
ALTER TABLE "private_bookings"
  ADD COLUMN "location_description" VARCHAR(300),
  ADD COLUMN "court_booking_id"     UUID,
  ADD COLUMN "court_id"             UUID,
  ADD COLUMN "court_cost_vnd"       INTEGER;
