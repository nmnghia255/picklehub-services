-- AlterTable
ALTER TABLE "private_bookings" ALTER COLUMN "payment_status" DROP NOT NULL,
ALTER COLUMN "payment_status" DROP DEFAULT;
