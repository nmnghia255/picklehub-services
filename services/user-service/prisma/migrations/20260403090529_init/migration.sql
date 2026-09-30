-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "PreferredHand" AS ENUM ('RIGHT', 'LEFT', 'AMBIDEXTROUS');

-- CreateTable: users
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(50),
    "avatar_url" VARCHAR(2048),
    "bio" VARCHAR(255),
    "gender" "Gender",
    "self_rating" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "preferred_hand" "PreferredHand",

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: dupr_profiles
CREATE TABLE "dupr_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "dupr_id" VARCHAR(100) NOT NULL,

    "rating" DOUBLE PRECISION,
    "singles_rating" DOUBLE PRECISION,
    "doubles_rating" DOUBLE PRECISION,

    "last_synced_at" TIMESTAMP,

    CONSTRAINT "dupr_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dupr_profiles_user_id_key" UNIQUE ("user_id"),
    CONSTRAINT "dupr_profiles_dupr_id_key" UNIQUE ("dupr_id"),

    CONSTRAINT "dupr_profiles_user_id_fkey"
        FOREIGN KEY ("user_id")
        REFERENCES "users"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Index (optional but recommended)
CREATE INDEX "dupr_profiles_dupr_id_idx" ON "dupr_profiles"("dupr_id");