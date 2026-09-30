-- CreateEnum
CREATE TYPE "EventFormat" AS ENUM ('single_elimination');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "bracketPosition" INTEGER,
ADD COLUMN     "externalMatchId" UUID,
ADD COLUMN     "nextMatchId" INTEGER;

-- AlterTable
ALTER TABLE "TournamentEvent" ADD COLUMN     "format" "EventFormat" NOT NULL DEFAULT 'single_elimination';

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_nextMatchId_fkey" FOREIGN KEY ("nextMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

