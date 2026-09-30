-- Add guest roster support for play sessions.
-- This migration is written defensively so it can run safely on databases
-- that may already contain part of the schema.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlaySessionGuestType') THEN
    CREATE TYPE "PlaySessionGuestType" AS ENUM ('DROP_IN', 'RESERVED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlaySessionGuestStatus') THEN
    CREATE TYPE "PlaySessionGuestStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'WAITLISTED', 'ON_HOLD');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "play_session_guests" (
  "id" UUID NOT NULL,
  "play_session_id" UUID NOT NULL,
  "requested_by_user_id" UUID NOT NULL,
  "requested_by_is_host" BOOLEAN NOT NULL DEFAULT false,
  "name" VARCHAR(120) NOT NULL,
  "skill_level" DECIMAL(4, 2),
  "type" "PlaySessionGuestType" NOT NULL DEFAULT 'DROP_IN',
  "status" "PlaySessionGuestStatus" NOT NULL DEFAULT 'REQUESTED',
  "approved_by_user_id" UUID,
  "approved_at" TIMESTAMP(6),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL,

  CONSTRAINT "play_session_guests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "play_session_guests_play_session_id_status_created_at_idx"
ON "play_session_guests"("play_session_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "play_session_guests_play_session_id_requested_by_user_id_idx"
ON "play_session_guests"("play_session_id", "requested_by_user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'play_session_guests_play_session_id_fkey'
  ) THEN
    ALTER TABLE "play_session_guests"
    ADD CONSTRAINT "play_session_guests_play_session_id_fkey"
    FOREIGN KEY ("play_session_id")
    REFERENCES "play_sessions"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;
