-- CreateTable
CREATE TABLE "device_push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "platform" VARCHAR(20),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "device_push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tickets" (
    "id" UUID NOT NULL,
    "ticket_id" VARCHAR(255) NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "checked_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_push_tokens_token_key" ON "device_push_tokens"("token");

-- CreateIndex
CREATE INDEX "device_push_tokens_user_id_idx" ON "device_push_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_tickets_ticket_id_key" ON "push_tickets"("ticket_id");

-- CreateIndex
CREATE INDEX "push_tickets_checked_at_idx" ON "push_tickets"("checked_at");

-- CreateIndex
CREATE INDEX "push_tickets_created_at_idx" ON "push_tickets"("created_at");
