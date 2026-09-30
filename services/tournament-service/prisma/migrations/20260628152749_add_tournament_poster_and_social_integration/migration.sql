-- CreateTable
CREATE TABLE "tournament_posters" (
    "id" SERIAL NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "metadata_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_posters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_integrations" (
    "id" SERIAL NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platform_page_id" TEXT NOT NULL,
    "page_name" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_posters_tournament_id_key" ON "tournament_posters"("tournament_id");

-- CreateIndex
CREATE INDEX "social_integrations_organizer_id_idx" ON "social_integrations"("organizer_id");

-- CreateIndex
CREATE UNIQUE INDEX "social_integrations_organizer_id_platform_platform_page_id_key" ON "social_integrations"("organizer_id", "platform", "platform_page_id");

-- AddForeignKey
ALTER TABLE "tournament_posters" ADD CONSTRAINT "tournament_posters_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
