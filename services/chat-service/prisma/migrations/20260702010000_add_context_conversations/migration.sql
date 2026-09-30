ALTER TYPE "ConversationType" ADD VALUE 'SOCIAL';
ALTER TYPE "ConversationType" ADD VALUE 'TOURNAMENT';

ALTER TABLE "conversations"
    ADD COLUMN "social_id" UUID,
    ADD COLUMN "tournament_id" UUID;

CREATE UNIQUE INDEX "conversations_social_id_key" ON "conversations"("social_id");
CREATE UNIQUE INDEX "conversations_tournament_id_key" ON "conversations"("tournament_id");
