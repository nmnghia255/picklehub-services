-- AlterTable
ALTER TABLE "app_notifications" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "group_feed_notifications" ADD COLUMN     "metadata" JSONB;
