-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "groupId" INTEGER,
ADD COLUMN     "groupStage" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TournamentEvent" ADD COLUMN     "advanceMethod" TEXT DEFAULT 'standard',
ADD COLUMN     "advancePerGroup" INTEGER,
ADD COLUMN     "groupStageEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "numGroups" INTEGER;

-- CreateTable
CREATE TABLE "GroupStageGroup" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "eventId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupStageGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupStageMembership" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "seed" INTEGER,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "gameDiff" INTEGER NOT NULL DEFAULT 0,
    "isAdvanced" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GroupStageMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentReferee" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "refereeId" TEXT NOT NULL,
    "refereeName" TEXT NOT NULL,
    "refereeEmail" TEXT,
    "refereeAvatar" TEXT,
    "phone" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentReferee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupStageMembership_groupId_teamId_key" ON "GroupStageMembership"("groupId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentReferee_tournamentId_refereeId_key" ON "TournamentReferee"("tournamentId", "refereeId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GroupStageGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStageGroup" ADD CONSTRAINT "GroupStageGroup_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStageGroup" ADD CONSTRAINT "GroupStageGroup_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "TournamentEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStageMembership" ADD CONSTRAINT "GroupStageMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GroupStageGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStageMembership" ADD CONSTRAINT "GroupStageMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentReferee" ADD CONSTRAINT "TournamentReferee_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
