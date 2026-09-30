-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "bookingId" INTEGER,
ADD COLUMN     "bookingItemId" UUID;

-- CreateTable
CREATE TABLE "TournamentBooking" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "externalBookingId" UUID NOT NULL,
    "centerId" UUID NOT NULL,
    "date" TEXT,
    "statusMirror" TEXT NOT NULL DEFAULT 'PENDING',
    "totalPrice" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TournamentBooking_externalBookingId_key" ON "TournamentBooking"("externalBookingId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "TournamentBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentBooking" ADD CONSTRAINT "TournamentBooking_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

