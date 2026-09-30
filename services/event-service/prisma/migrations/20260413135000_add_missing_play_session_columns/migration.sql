-- AlterTable
ALTER TABLE "play_sessions"
ADD COLUMN IF NOT EXISTS     "allow_guests" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS     "fee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "play_session_participants"
ADD COLUMN IF NOT EXISTS     "guests_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS     "payment_receipt_url" VARCHAR(500),
ADD COLUMN IF NOT EXISTS     "is_checked_in" BOOLEAN NOT NULL DEFAULT false;

-- AlterEnum
ALTER TYPE "PlaySessionParticipantStatus" ADD VALUE IF NOT EXISTS 'PENDING';

-- AlterEnum
ALTER TYPE "PlaySessionParticipantStatus" ADD VALUE IF NOT EXISTS 'CHECKED_IN';

-- AlterEnum
ALTER TYPE "PlaySessionParticipantStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
