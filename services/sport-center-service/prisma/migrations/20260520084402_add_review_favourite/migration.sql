-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favourites" (
    "id" UUID NOT NULL,
    "center_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favourites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_center_id_idx" ON "reviews"("center_id");

-- CreateIndex
CREATE INDEX "reviews_user_id_idx" ON "reviews"("user_id");

-- CreateIndex
CREATE INDEX "favourites_user_id_idx" ON "favourites"("user_id");

-- CreateIndex
CREATE INDEX "favourites_center_id_idx" ON "favourites"("center_id");

-- CreateIndex
CREATE UNIQUE INDEX "favourites_user_id_center_id_key" ON "favourites"("user_id", "center_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "sport_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "sport_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
