-- Enforce exactly-at-most-one OWNER per group at database level.
-- This prevents data races from creating multiple owners in the same group.
CREATE UNIQUE INDEX "group_members_one_owner_per_group_uidx"
ON "group_members" ("group_id")
WHERE "role" = 'OWNER';
