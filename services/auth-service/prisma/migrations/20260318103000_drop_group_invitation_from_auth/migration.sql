/*
  Migration: drop group/invitation tables from auth-service after extraction to group-service
*/

-- Drop tables that were moved to group-service
DROP TABLE IF EXISTS "group_members";
DROP TABLE IF EXISTS "invitations";
DROP TABLE IF EXISTS "groups";

-- Drop enums no longer used by auth-service
DROP TYPE IF EXISTS "GroupMemberRole";
DROP TYPE IF EXISTS "InvitationStatus";
