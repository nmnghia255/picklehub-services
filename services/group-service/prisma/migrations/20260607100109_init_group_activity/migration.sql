-- CreateEnum
CREATE TYPE "GroupActivityType" AS ENUM ('PRACTICE', 'MEETUP', 'INTERNAL_MATCH', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "GroupActivityStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "group_expenses" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "group_payments" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "expires_at" SET DEFAULT NOW() + INTERVAL '7 days';

-- CreateTable
CREATE TABLE "group_activities" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "location" VARCHAR(255),
    "activity_type" "GroupActivityType" NOT NULL DEFAULT 'MEETUP',
    "start_at" TIMESTAMP(6) NOT NULL,
    "end_at" TIMESTAMP(6) NOT NULL,
    "remind_at" TIMESTAMP(6),
    "status" "GroupActivityStatus" NOT NULL DEFAULT 'SCHEDULED',
    "is_reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "group_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_activities_group_id_idx" ON "group_activities"("group_id");

-- CreateIndex
CREATE INDEX "group_activities_start_at_idx" ON "group_activities"("start_at");

-- CreateIndex
CREATE INDEX "group_activities_created_by_idx" ON "group_activities"("created_by");

-- AddForeignKey
ALTER TABLE "group_activities" ADD CONSTRAINT "group_activities_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
