-- CreateTable
CREATE TABLE "social_stats" (
    "id" UUID NOT NULL,
    "social_id" UUID NOT NULL,
    "total_matches" INTEGER NOT NULL DEFAULT 0,
    "active_players" INTEGER NOT NULL DEFAULT 0,
    "court_hours" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    "player_stats" JSONB NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "social_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_feedbacks" (
    "id" UUID NOT NULL,
    "social_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating_venue" INTEGER NOT NULL,
    "rating_host" INTEGER NOT NULL,
    "rating_matchmaking" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "social_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_stats_social_id_key" ON "social_stats"("social_id");

-- CreateIndex
CREATE INDEX "social_feedbacks_social_id_idx" ON "social_feedbacks"("social_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_feedbacks_social_id_user_id_key" ON "social_feedbacks"("social_id", "user_id");

-- AddForeignKey
ALTER TABLE "social_stats" ADD CONSTRAINT "social_stats_social_id_fkey" FOREIGN KEY ("social_id") REFERENCES "socials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_feedbacks" ADD CONSTRAINT "social_feedbacks_social_id_fkey" FOREIGN KEY ("social_id") REFERENCES "socials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
