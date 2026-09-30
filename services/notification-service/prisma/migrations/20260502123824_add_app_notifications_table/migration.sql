-- CreateTable
CREATE TABLE "app_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_notifications_user_id_idx" ON "app_notifications"("user_id");

-- CreateIndex
CREATE INDEX "app_notifications_is_read_idx" ON "app_notifications"("is_read");

-- CreateIndex
CREATE INDEX "app_notifications_created_at_idx" ON "app_notifications"("created_at");
