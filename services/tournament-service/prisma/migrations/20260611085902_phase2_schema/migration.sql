-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "refereeId" TEXT,
ADD COLUMN     "refereeName" TEXT;

-- CreateTable
CREATE TABLE "CheckIn" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "player1CheckedIn" BOOLEAN NOT NULL DEFAULT false,
    "player1CheckedInAt" TIMESTAMP(3),
    "player2CheckedIn" BOOLEAN NOT NULL DEFAULT false,
    "player2CheckedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckIn_registrationId_key" ON "CheckIn"("registrationId");

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
