-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlaySessionStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "PlaySessionStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "play_session_participants" ADD COLUMN     "guest_name" VARCHAR(120),
ADD COLUMN     "is_guest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skill_level" DECIMAL(4,2),
ALTER COLUMN "user_id" DROP NOT NULL;
