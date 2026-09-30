-- CreateEnum
CREATE TYPE "BookingCancelReason" AS ENUM ('COURT_MAINTENANCE', 'COURT_ARCHIVED', 'OWNER_MANUAL', 'PLAYER_CANCEL');

-- DropIndex
DROP INDEX "bookings_court_id_date_start_time_key";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cancel_reason" "BookingCancelReason";

-- AlterTable
ALTER TABLE "sport_centers" ALTER COLUMN "base_price" DROP DEFAULT;

-- Appended by hand as Prisma's `@@unique` doesn't support partial indexes
CREATE UNIQUE INDEX "bookings_active_court_date_start_time_key"
  ON "bookings" ("court_id", "date", "start_time")
  WHERE "status" IN ('PENDING', 'CONFIRMED');
