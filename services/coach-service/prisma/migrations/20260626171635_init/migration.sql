-- CreateEnum
CREATE TYPE "CoachStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('DRAFT', 'OPEN', 'FULL', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING_PROOF', 'PENDING_REVIEW', 'SETTLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('CLASS', 'PRIVATE_BOOKING');

-- CreateTable
CREATE TABLE "coach_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "bio" TEXT,
    "avatar_url" VARCHAR(500),
    "level" VARCHAR(50),
    "years_experience" INTEGER,
    "specialties" TEXT[],
    "languages" TEXT[],
    "location_city" VARCHAR(100),
    "hourly_rate_vnd" INTEGER,
    "payment_account_name" VARCHAR(255) NOT NULL,
    "payment_account_number" VARCHAR(50) NOT NULL,
    "payment_bank_name" VARCHAR(100) NOT NULL,
    "payment_qr_url" VARCHAR(500),
    "status" "CoachStatus" NOT NULL DEFAULT 'DRAFT',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "average_rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "coach_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_certifications" (
    "id" UUID NOT NULL,
    "coach_profile_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "issuing_organization" VARCHAR(200),
    "issued_at" TIMESTAMP(6),
    "expires_at" TIMESTAMP(6),
    "document_url" VARCHAR(500),
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_user_id" UUID,
    "review_note" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "coach_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coach_profiles_user_id_key" ON "coach_profiles"("user_id");

-- CreateIndex
CREATE INDEX "coach_profiles_status_idx" ON "coach_profiles"("status");

-- CreateIndex
CREATE INDEX "coach_profiles_location_city_idx" ON "coach_profiles"("location_city");

-- CreateIndex
CREATE INDEX "coach_profiles_average_rating_idx" ON "coach_profiles"("average_rating");

-- CreateIndex
CREATE INDEX "coach_certifications_coach_profile_id_idx" ON "coach_certifications"("coach_profile_id");

-- CreateIndex
CREATE INDEX "coach_certifications_verification_status_idx" ON "coach_certifications"("verification_status");

-- AddForeignKey
ALTER TABLE "coach_certifications" ADD CONSTRAINT "coach_certifications_coach_profile_id_fkey" FOREIGN KEY ("coach_profile_id") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
