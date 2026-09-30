CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP');
CREATE TYPE "ParticipantRole" AS ENUM ('MEMBER', 'OWNER', 'SYSTEM');
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'MEDIA', 'SYSTEM');

CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "ConversationType" NOT NULL,
    "group_id" UUID,
    "direct_user_a_id" UUID,
    "direct_user_b_id" UUID,
    "last_message_id" UUID,
    "last_message_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ParticipantRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_read_message_id" UUID,
    "last_read_at" TIMESTAMP(6),
    "muted_until" TIMESTAMP(6),
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "body" TEXT,
    "media_url" TEXT,
    "metadata" JSONB,
    "edited_at" TIMESTAMP(6),
    "deleted_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversations_group_id_key" ON "conversations"("group_id");
CREATE UNIQUE INDEX "conversations_direct_pair_uidx" ON "conversations"("direct_user_a_id", "direct_user_b_id");
CREATE INDEX "conversations_type_idx" ON "conversations"("type");
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");
CREATE UNIQUE INDEX "conversation_participants_conversation_user_uidx" ON "conversation_participants"("conversation_id", "user_id");
CREATE INDEX "conversation_participants_user_id_idx" ON "conversation_participants"("user_id");
CREATE INDEX "conversation_participants_deleted_at_idx" ON "conversation_participants"("deleted_at");
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
CREATE INDEX "messages_sender_id_idx" ON "messages"("sender_id");
CREATE INDEX "messages_deleted_at_idx" ON "messages"("deleted_at");

ALTER TABLE "conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages"
    ADD CONSTRAINT "messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
