-- AlterEnum
ALTER TYPE "PlaySessionParticipantStatus" ADD VALUE 'CANCELLED_BY_SYSTEM';

-- AlterEnum
ALTER TYPE "PlaySessionStatus" ADD VALUE 'PUBLISHED';

-- AlterTable
ALTER TABLE "play_session_participants" ADD COLUMN     "guests_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_checked_in" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "play_sessions" ADD COLUMN     "allow_guests" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fee" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "play_session_id" UUID NOT NULL,
    "court_number" INTEGER NOT NULL,
    "team_a" JSONB NOT NULL,
    "team_b" JSONB NOT NULL,
    "is_unrated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matches_play_session_id_idx" ON "matches"("play_session_id");

-- CreateIndex
CREATE INDEX "matches_court_number_idx" ON "matches"("court_number");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_play_session_id_fkey" FOREIGN KEY ("play_session_id") REFERENCES "play_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
