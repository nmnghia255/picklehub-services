-- CreateTable
CREATE TABLE "group_court_bookings" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "note" TEXT,
    "linked_by" UUID NOT NULL,
    "booking_id" TEXT NOT NULL,
    "center_id" UUID,
    "center_name" VARCHAR(255),
    "center_address" VARCHAR(500),
    "total_booking_cost" INTEGER NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,
    "start_time" TIMESTAMP(6) NOT NULL,
    "end_time" TIMESTAMP(6) NOT NULL,
    "booking_items_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "group_court_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_court_bookings_group_id_idx" ON "group_court_bookings"("group_id");

-- CreateIndex
CREATE INDEX "group_court_bookings_date_idx" ON "group_court_bookings"("date");

-- CreateIndex
CREATE INDEX "group_court_bookings_linked_by_idx" ON "group_court_bookings"("linked_by");

-- AddForeignKey
ALTER TABLE "group_court_bookings" ADD CONSTRAINT "group_court_bookings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
