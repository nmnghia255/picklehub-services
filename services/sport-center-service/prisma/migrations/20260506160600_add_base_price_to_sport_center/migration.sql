-- AlterTable: add base_price (required fallback price when no price slot covers a time window)
ALTER TABLE "sport_centers" ADD COLUMN "base_price" DECIMAL(10,2) NOT NULL DEFAULT 0;
