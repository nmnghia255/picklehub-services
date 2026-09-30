-- AlterEnum
ALTER TYPE "TournamentStatus" ADD VALUE 'closed_registration';

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "description" TEXT;
