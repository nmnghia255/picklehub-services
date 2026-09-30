-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "partnerAge" INTEGER,
ADD COLUMN     "partnerGender" TEXT,
ADD COLUMN     "playerAge" INTEGER,
ADD COLUMN     "playerGender" TEXT;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "player1Age" INTEGER,
ADD COLUMN     "player1Gender" TEXT,
ADD COLUMN     "player2Age" INTEGER,
ADD COLUMN     "player2Gender" TEXT;
