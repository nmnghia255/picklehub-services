-- CreateEnum
CREATE TYPE "SocialPaymentStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'REJECTED');

-- AlterTable
ALTER TABLE "social_payments" ADD COLUMN     "status" "SocialPaymentStatus" NOT NULL DEFAULT 'PENDING_REVIEW';
