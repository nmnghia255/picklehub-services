-- DropEnum
DROP TYPE "ReviewTargetType";

-- CreateTable
CREATE TABLE "coach_reviews" (
    "id" UUID NOT NULL,
    "coach_profile_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_recommendations" (
    "id" UUID NOT NULL,
    "coach_profile_id" UUID NOT NULL,
    "recommender_id" UUID NOT NULL,
    "recommended_to_id" UUID NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_reviews_coach_profile_id_idx" ON "coach_reviews"("coach_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "coach_reviews_coach_profile_id_reviewer_id_key" ON "coach_reviews"("coach_profile_id", "reviewer_id");

-- CreateIndex
CREATE INDEX "coach_recommendations_coach_profile_id_idx" ON "coach_recommendations"("coach_profile_id");

-- CreateIndex
CREATE INDEX "coach_recommendations_recommended_to_id_idx" ON "coach_recommendations"("recommended_to_id");

-- AddForeignKey
ALTER TABLE "coach_reviews" ADD CONSTRAINT "coach_reviews_coach_profile_id_fkey" FOREIGN KEY ("coach_profile_id") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_recommendations" ADD CONSTRAINT "coach_recommendations_coach_profile_id_fkey" FOREIGN KEY ("coach_profile_id") REFERENCES "coach_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "private_bookings_requested_at_idx" RENAME TO "private_bookings_session_at_idx";
