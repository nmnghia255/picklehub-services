-- CreateTable
CREATE TABLE "tournament_referee_invitations" (
    "id" SERIAL NOT NULL,
    "tournament_id" INTEGER NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_referee_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_referee_invitations_token_key" ON "tournament_referee_invitations"("token");

-- CreateIndex
CREATE INDEX "tournament_referee_invitations_token_idx" ON "tournament_referee_invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_referee_invitations_tournament_id_email_key" ON "tournament_referee_invitations"("tournament_id", "email");

-- AddForeignKey
ALTER TABLE "tournament_referee_invitations" ADD CONSTRAINT "tournament_referee_invitations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
