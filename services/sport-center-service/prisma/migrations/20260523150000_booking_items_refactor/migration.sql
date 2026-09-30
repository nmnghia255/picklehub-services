-- Backfill the booking refactor without losing historical data.

-- Add the new center_id column first so we can populate it from the legacy court relation.
ALTER TABLE "bookings" ADD COLUMN "center_id" UUID;

UPDATE "bookings" b
SET "center_id" = c."center_id"
FROM "courts" c
WHERE b."court_id" = c."id";

ALTER TABLE "bookings" ALTER COLUMN "center_id" SET NOT NULL;

-- Create the new booking_items table before dropping the legacy booking time/court columns.
CREATE TABLE "booking_items" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "start_time" VARCHAR(8) NOT NULL,
    "end_time" VARCHAR(8) NOT NULL,
    "item_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_items_pkey" PRIMARY KEY ("id")
);

-- Preserve historical bookings by creating one booking item for each legacy booking row.
INSERT INTO "booking_items" (
    "id",
    "booking_id",
    "court_id",
    "start_time",
    "end_time",
    "item_price",
    "created_at"
)
SELECT
    md5(random()::text || clock_timestamp()::text)::uuid,
    b."id",
    b."court_id",
    b."start_time",
    b."end_time",
    COALESCE(b."total_price", 0),
    b."created_at"
FROM "bookings" b;

CREATE INDEX "booking_items_booking_id_idx" ON "booking_items"("booking_id");
CREATE INDEX "booking_items_court_id_idx" ON "booking_items"("court_id");
CREATE INDEX "bookings_center_id_date_idx" ON "bookings"("center_id", "date");

ALTER TABLE "bookings" DROP CONSTRAINT "bookings_court_id_fkey";

DROP INDEX "bookings_court_id_date_idx";

ALTER TABLE "bookings"
  DROP COLUMN "court_id",
  DROP COLUMN "end_time",
  DROP COLUMN "start_time";

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "sport_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
