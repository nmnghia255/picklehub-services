-- Add waitlist support for play session participants.
CREATE TYPE "PlaySessionParticipantStatus" AS ENUM ('JOINED', 'WAITLISTED');

ALTER TABLE "play_session_participants"
ADD COLUMN "status" "PlaySessionParticipantStatus" NOT NULL DEFAULT 'JOINED';

CREATE INDEX "play_session_participants_play_session_id_status_joined_at_idx"
ON "play_session_participants"("play_session_id", "status", "joined_at");
