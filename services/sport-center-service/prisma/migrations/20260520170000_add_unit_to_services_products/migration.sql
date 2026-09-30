-- Add display units to services and products
ALTER TABLE "services" ADD COLUMN "unit" VARCHAR(100);
ALTER TABLE "products" ADD COLUMN "unit" VARCHAR(100);
