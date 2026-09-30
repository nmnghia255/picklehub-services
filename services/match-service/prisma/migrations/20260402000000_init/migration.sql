-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'PENDING_CONFIRM', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('SINGLES', 'DOUBLES', 'PRACTICE');

-- CreateEnum
CREATE TYPE "WinnerTeam" AS ENUM ('TEAM_A', 'TEAM_B', 'DRAW');

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "match_type" "MatchType" NOT NULL DEFAULT 'SINGLES',
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMP(6) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "court_id" UUID,
    "group_id" UUID,
    "tournament_id" UUID,
    "score_a" INTEGER NOT NULL DEFAULT 0,
    "score_b" INTEGER NOT NULL DEFAULT 0,
    "sets" JSONB,
    "winner" "WinnerTeam",
    "team_a" UUID[],
    "team_b" UUID[],
    "referee_id" UUID,
    "confirmed_by_a" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by_b" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by_ref" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(6),
    "finished_at" TIMESTAMP(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_updates" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "score_a" INTEGER NOT NULL,
    "score_b" INTEGER NOT NULL,
    "sets" JSONB,
    "note" VARCHAR(255),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_updates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE INDEX "matches_scheduled_at_idx" ON "matches"("scheduled_at");

-- CreateIndex
CREATE INDEX "matches_created_by_idx" ON "matches"("created_by");

-- CreateIndex
CREATE INDEX "matches_group_id_idx" ON "matches"("group_id");

-- CreateIndex
CREATE INDEX "matches_tournament_id_idx" ON "matches"("tournament_id");

-- CreateIndex
CREATE INDEX "score_updates_match_id_idx" ON "score_updates"("match_id");

-- AddForeignKey
ALTER TABLE "score_updates" ADD CONSTRAINT "score_updates_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
