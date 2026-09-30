-- Backfill ADMIN to MEMBER first
UPDATE "group_members" SET "role" = 'MEMBER' WHERE "role"::text = 'ADMIN';

-- Create new enum
CREATE TYPE "GroupMemberRole_new" AS ENUM ('OWNER', 'MEMBER');

-- Drop indexes that depend on the column or its type
DROP INDEX IF EXISTS "group_members_role_idx";
DROP INDEX IF EXISTS "group_members_one_owner_per_group_uidx";

-- Alter table to use new enum
ALTER TABLE "group_members" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "group_members" ALTER COLUMN "role" TYPE "GroupMemberRole_new" USING ("role"::text::"GroupMemberRole_new");

-- Swap types
ALTER TYPE "GroupMemberRole" RENAME TO "GroupMemberRole_old";
ALTER TYPE "GroupMemberRole_new" RENAME TO "GroupMemberRole";
DROP TYPE "GroupMemberRole_old";

-- Restore default and indexes
ALTER TABLE "group_members" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
CREATE INDEX "group_members_role_idx" ON "group_members"("role");
CREATE UNIQUE INDEX "group_members_one_owner_per_group_uidx" ON "group_members"("group_id") WHERE role = 'OWNER'::"GroupMemberRole";


