-- AlterTable
ALTER TABLE "sport_centers" ADD COLUMN "email" VARCHAR(255),
ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "rules" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "description" TEXT;

-- DropForeignKey
ALTER TABLE "court_price_slots" DROP CONSTRAINT "court_price_slots_court_id_fkey";

-- DropTable
DROP TABLE "court_price_slots";

-- CreateTable
CREATE TABLE "center_price_slots" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "start_time" VARCHAR(8) NOT NULL,
    "end_time" VARCHAR(8) NOT NULL,
    "price_per_hour" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "center_price_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "center_price_slots_center_id_idx" ON "center_price_slots"("center_id");

-- AddForeignKey
ALTER TABLE "center_price_slots" ADD CONSTRAINT "center_price_slots_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "sport_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
