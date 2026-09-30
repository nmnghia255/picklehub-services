-- CreateTable
CREATE TABLE "group_feed_notifications" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_feed_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_feed_notifications_group_id_idx" ON "group_feed_notifications"("group_id");

-- CreateIndex
CREATE INDEX "group_feed_notifications_created_at_idx" ON "group_feed_notifications"("created_at");
