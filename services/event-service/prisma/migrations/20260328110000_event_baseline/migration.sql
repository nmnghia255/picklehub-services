-- Baseline migration for event-service before waitlist support.
-- Creates tables and enums without PlaySessionParticipantStatus/status column.

CREATE TYPE "PlaySessionType" AS ENUM ('PUBLIC_APP', 'INTERNAL_GROUP');
CREATE TYPE "PlaySessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "events" (
  "id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "start_at" TIMESTAMP(6) NOT NULL,
  "end_at" TIMESTAMP(6) NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL,

  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "play_sessions" (
  "id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "type" "PlaySessionType" NOT NULL,
  "group_id" UUID,
  "location" VARCHAR(255),
  "court_booking_id" UUID,
  "max_slots" INTEGER NOT NULL,
  "joined_count" INTEGER NOT NULL DEFAULT 0,
  "start_time" TIMESTAMP(6) NOT NULL,
  "end_time" TIMESTAMP(6) NOT NULL,
  "status" "PlaySessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "creator_id" UUID NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) NOT NULL,

  CONSTRAINT "play_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "play_session_participants" (
  "id" UUID NOT NULL,
  "play_session_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "joined_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "play_session_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "play_session_participants_play_session_id_user_id_key"
ON "play_session_participants"("play_session_id", "user_id");

CREATE INDEX "events_start_at_idx" ON "events"("start_at");
CREATE INDEX "play_sessions_group_id_idx" ON "play_sessions"("group_id");
CREATE INDEX "play_sessions_start_time_idx" ON "play_sessions"("start_time");
CREATE INDEX "play_sessions_type_idx" ON "play_sessions"("type");
CREATE INDEX "play_sessions_status_idx" ON "play_sessions"("status");
CREATE INDEX "play_session_participants_user_id_idx" ON "play_session_participants"("user_id");

ALTER TABLE "play_session_participants"
ADD CONSTRAINT "play_session_participants_play_session_id_fkey"
FOREIGN KEY ("play_session_id") REFERENCES "play_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
