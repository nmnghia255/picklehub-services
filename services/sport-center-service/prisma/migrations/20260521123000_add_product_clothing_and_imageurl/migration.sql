-- Add CLOTHING to ProductType enum
ALTER TYPE "ProductType" ADD VALUE 'CLOTHING';

-- Add optional image_url columns to services and products
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(500);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(500);
