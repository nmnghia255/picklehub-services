-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateTable
CREATE TABLE "court_price_slots" (
    "id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "start_time" VARCHAR(8) NOT NULL,
    "end_time" VARCHAR(8) NOT NULL,
    "price_per_hour" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "court_price_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_time" VARCHAR(8) NOT NULL,
    "end_time" VARCHAR(8) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "total_price" DECIMAL(10,2),
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "cancelled_at" TIMESTAMP(6),

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "court_price_slots_court_id_idx" ON "court_price_slots"("court_id");

-- CreateIndex
CREATE INDEX "bookings_player_id_idx" ON "bookings"("player_id");

-- CreateIndex
CREATE INDEX "bookings_court_id_date_idx" ON "bookings"("court_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_court_id_date_start_time_key" ON "bookings"("court_id", "date", "start_time");

-- AddForeignKey
ALTER TABLE "court_price_slots" ADD CONSTRAINT "court_price_slots_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
