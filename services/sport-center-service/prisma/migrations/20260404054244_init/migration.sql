-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SportCenterStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CourtType" AS ENUM ('INDOOR', 'OUTDOOR');

-- CreateEnum
CREATE TYPE "CourtStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "sport_centers" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "open_time" VARCHAR(8) NOT NULL,
    "close_time" VARCHAR(8) NOT NULL,
    "status" "SportCenterStatus" NOT NULL DEFAULT 'PENDING',
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "sport_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courts" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "CourtType" NOT NULL,
    "status" "CourtStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sport_centers_owner_id_idx" ON "sport_centers"("owner_id");

-- CreateIndex
CREATE INDEX "sport_centers_status_idx" ON "sport_centers"("status");

-- CreateIndex
CREATE INDEX "courts_center_id_idx" ON "courts"("center_id");

-- CreateIndex
CREATE INDEX "courts_status_idx" ON "courts"("status");

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "sport_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

