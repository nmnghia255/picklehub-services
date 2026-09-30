-- Add optional avatar URL for user profile; nullable for backward compatibility.
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "avatar_url" VARCHAR(500);
