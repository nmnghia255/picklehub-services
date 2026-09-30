-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventFormat" ADD VALUE 'double_elimination';
ALTER TYPE "EventFormat" ADD VALUE 'round_robin';

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "loserMatchId" INTEGER,
ADD COLUMN     "stage" VARCHAR(50);

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_loserMatchId_fkey" FOREIGN KEY ("loserMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
