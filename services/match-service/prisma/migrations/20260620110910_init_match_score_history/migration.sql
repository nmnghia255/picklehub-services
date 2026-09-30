-- CreateTable
CREATE TABLE "match_score_history" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "set_id" INTEGER NOT NULL,
    "scoring_team" TEXT NOT NULL,
    "point_type" TEXT NOT NULL DEFAULT 'NORMAL',
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_score_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_score_history_match_id_idx" ON "match_score_history"("match_id");

-- CreateIndex
CREATE INDEX "match_score_history_timestamp_idx" ON "match_score_history"("timestamp");

-- AddForeignKey
ALTER TABLE "match_score_history" ADD CONSTRAINT "match_score_history_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
