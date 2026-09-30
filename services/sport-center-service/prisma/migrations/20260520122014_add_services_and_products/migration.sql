-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('EQUIPMENT_RENTAL', 'COACHING', 'FACILITY_ADD_ON');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('BEVERAGE', 'CONSUMABLE', 'EQUIPMENT');

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" "ServiceType" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_services" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_products" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "services_center_id_idx" ON "services"("center_id");

-- CreateIndex
CREATE INDEX "services_is_active_idx" ON "services"("is_active");

-- CreateIndex
CREATE INDEX "products_center_id_idx" ON "products"("center_id");

-- CreateIndex
CREATE INDEX "products_is_active_idx" ON "products"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "booking_services_booking_id_service_id_key" ON "booking_services"("booking_id", "service_id");

-- CreateIndex
CREATE INDEX "booking_services_booking_id_idx" ON "booking_services"("booking_id");

-- CreateIndex
CREATE INDEX "booking_services_service_id_idx" ON "booking_services"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_products_booking_id_product_id_key" ON "booking_products"("booking_id", "product_id");

-- CreateIndex
CREATE INDEX "booking_products_booking_id_idx" ON "booking_products"("booking_id");

-- CreateIndex
CREATE INDEX "booking_products_product_id_idx" ON "booking_products"("product_id");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "sport_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "sport_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_services" ADD CONSTRAINT "booking_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_products" ADD CONSTRAINT "booking_products_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_products" ADD CONSTRAINT "booking_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
