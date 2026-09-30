-- Migration: add_phone_number_to_booking
-- Adds an optional phone number snapshot to bookings.

ALTER TABLE "bookings" ADD COLUMN "phone_number" VARCHAR(20);
