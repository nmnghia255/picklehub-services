-- AlterTable
ALTER TABLE "groups"
ADD COLUMN "avatar_url" TEXT;

-- Backfill and enforce member limit default
UPDATE "groups"
SET "max_members" = 50
WHERE "max_members" IS NULL;

ALTER TABLE "groups"
ALTER COLUMN "max_members" SET DEFAULT 50,
ALTER COLUMN "max_members" SET NOT NULL;
