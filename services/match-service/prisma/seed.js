"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const MAIN_USER_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_USER_ID = '22222222-2222-4222-8222-222222222222';
const REFEREE_ID = 'f0000000-f000-4000-8000-000000000000';
const PLAYER_1_ID = '33333333-3333-4333-8333-333333333333';
const PLAYER_2_ID = '44444444-4444-4444-8444-444444444444';
const PLAYER_3_ID = '55555555-5555-4555-8555-555555555555';
const SPORT_CENTER_COURT_1_ID = 'c0010000-c001-4000-8000-000000010001';
const PLAYER_01_ID = '6e14cbd8-220f-4ebc-9235-b9a1b8fc4f47';
const PLAYER_02_ID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';
const PLAYER_03_ID = 'f31f0529-6c82-43a2-a785-bb3d77f8a34e';
const SESSION_COMPLETED_ID = 'f14cbe8d-220f-4ebc-9235-b9a1b8fc4f47';
const MATCH_1_ID = 'e0000001-e000-4000-8000-000000000000';
const MATCH_2_ID = 'e0000002-e000-4000-8000-000000000000';
const MATCH_3_ID = 'e0000003-e000-4000-8000-000000000000';
const MATCH_4_ID = 'e0000004-e000-4000-8000-000000000000';
const MATCH_5_ID = 'e0000005-e000-4000-8000-000000000000';
const MATCH_6_ID = 'e0000006-e000-4000-8000-000000000000';
const MATCH_7_ID = 'e0000007-e000-4000-8000-000000000000';
const MATCH_8_ID = 'e0000008-e000-4000-8000-000000000000';
const MATCH_9_ID = 'e0000009-e000-4000-8000-000000000000';
async function main() {
    console.log('Seeding match-service data...');
    const mainUserTeam = [MAIN_USER_ID];
    const player1Team = [PLAYER_1_ID];
    const doublesTeamA = [MAIN_USER_ID, PLAYER_1_ID];
    const doublesTeamB = [PLAYER_2_ID, PLAYER_3_ID];
    await prisma.match.upsert({
        where: { id: MATCH_1_ID },
        update: {
            category: client_1.MatchCategory.CUSTOM,
            matchType: client_1.MatchType.SINGLES,
            status: client_1.MatchStatus.SCHEDULED,
            scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            teamA: mainUserTeam,
            teamB: player1Team,
            refereeId: REFEREE_ID,
            createdById: MAIN_USER_ID,
        },
        create: {
            id: MATCH_1_ID,
            category: client_1.MatchCategory.CUSTOM,
            matchType: client_1.MatchType.SINGLES,
            status: client_1.MatchStatus.SCHEDULED,
            scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            teamA: mainUserTeam,
            teamB: player1Team,
            refereeId: REFEREE_ID,
            createdById: MAIN_USER_ID,
        },
    });
    await prisma.match.upsert({
        where: { id: MATCH_2_ID },
        update: {
            category: client_1.MatchCategory.CUSTOM,
            matchType: client_1.MatchType.DOUBLES,
            status: client_1.MatchStatus.LIVE,
            scheduledAt: new Date(),
            startedAt: new Date(),
            courtId: SPORT_CENTER_COURT_1_ID,
            scoreA: 5,
            scoreB: 3,
            teamA: doublesTeamA,
            teamB: doublesTeamB,
            refereeId: REFEREE_ID,
            createdById: MAIN_USER_ID,
        },
        create: {
            id: MATCH_2_ID,
            category: client_1.MatchCategory.CUSTOM,
            matchType: client_1.MatchType.DOUBLES,
            status: client_1.MatchStatus.LIVE,
            scheduledAt: new Date(),
            startedAt: new Date(),
            courtId: SPORT_CENTER_COURT_1_ID,
            scoreA: 5,
            scoreB: 3,
            teamA: doublesTeamA,
            teamB: doublesTeamB,
            refereeId: REFEREE_ID,
            createdById: MAIN_USER_ID,
        },
    });
    await prisma.match.upsert({
        where: { id: MATCH_3_ID },
        update: {
            category: client_1.MatchCategory.CUSTOM,
            matchType: client_1.MatchType.SINGLES,
            status: client_1.MatchStatus.CONFIRMED,
            scheduledAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
            startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
            finishedAt: new Date(Date.now() - 47 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            scoreA: 2,
            scoreB: 1,
            sets: [[11, 5], [9, 11], [11, 8]],
            winner: client_1.WinnerTeam.TEAM_A,
            confirmedByA: true,
            confirmedByB: true,
            teamA: mainUserTeam,
            teamB: player1Team,
            createdById: MAIN_USER_ID,
        },
        create: {
            id: MATCH_3_ID,
            category: client_1.MatchCategory.CUSTOM,
            matchType: client_1.MatchType.SINGLES,
            status: client_1.MatchStatus.CONFIRMED,
            scheduledAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
            startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
            finishedAt: new Date(Date.now() - 47 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            scoreA: 2,
            scoreB: 1,
            sets: [[11, 5], [9, 11], [11, 8]],
            winner: client_1.WinnerTeam.TEAM_A,
            confirmedByA: true,
            confirmedByB: true,
            teamA: mainUserTeam,
            teamB: player1Team,
            createdById: MAIN_USER_ID,
        },
    });
    await prisma.match.upsert({
        where: { id: MATCH_4_ID },
        update: {
            category: client_1.MatchCategory.CUSTOM,
            matchType: client_1.MatchType.SINGLES,
            status: client_1.MatchStatus.PENDING_CONFIRM,
            scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            teamA: player1Team,
            teamB: [PLAYER_2_ID],
            refereeId: MAIN_USER_ID,
            createdById: PLAYER_1_ID,
        },
        create: {
            id: MATCH_4_ID,
            category: client_1.MatchCategory.CUSTOM,
            matchType: client_1.MatchType.SINGLES,
            status: client_1.MatchStatus.PENDING_CONFIRM,
            scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            teamA: player1Team,
            teamB: [PLAYER_2_ID],
            refereeId: MAIN_USER_ID,
            createdById: PLAYER_1_ID,
        },
    });
    await prisma.match.upsert({
        where: { id: MATCH_5_ID },
        update: {
            category: client_1.MatchCategory.CUSTOM,
            matchType: client_1.MatchType.SINGLES,
            status: client_1.MatchStatus.CANCELLED,
            scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            teamA: mainUserTeam,
            teamB: player1Team,
            createdById: MAIN_USER_ID,
        },
        create: {
            id: MATCH_5_ID,
            category: client_1.MatchCategory.CUSTOM,
            matchType: client_1.MatchType.SINGLES,
            status: client_1.MatchStatus.CANCELLED,
            scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            teamA: mainUserTeam,
            teamB: player1Team,
            createdById: MAIN_USER_ID,
        },
    });
    await prisma.match.upsert({
        where: { id: MATCH_6_ID },
        update: {
            category: client_1.MatchCategory.SOCIAL,
            matchType: client_1.MatchType.DOUBLES,
            status: client_1.MatchStatus.CONFIRMED,
            scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            finishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            scoreA: 11,
            scoreB: 8,
            winner: client_1.WinnerTeam.TEAM_A,
            confirmedByA: true,
            confirmedByB: true,
            teamA: [MAIN_USER_ID, PLAYER_01_ID],
            teamB: [PLAYER_02_ID, PLAYER_03_ID],
            playSessionId: SESSION_COMPLETED_ID,
            createdById: MAIN_USER_ID,
        },
        create: {
            id: MATCH_6_ID,
            category: client_1.MatchCategory.SOCIAL,
            matchType: client_1.MatchType.DOUBLES,
            status: client_1.MatchStatus.CONFIRMED,
            scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            finishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            scoreA: 11,
            scoreB: 8,
            winner: client_1.WinnerTeam.TEAM_A,
            confirmedByA: true,
            confirmedByB: true,
            teamA: [MAIN_USER_ID, PLAYER_01_ID],
            teamB: [PLAYER_02_ID, PLAYER_03_ID],
            playSessionId: SESSION_COMPLETED_ID,
            createdById: MAIN_USER_ID,
        },
    });
    await prisma.match.upsert({
        where: { id: MATCH_7_ID },
        update: {
            category: client_1.MatchCategory.SOCIAL,
            matchType: client_1.MatchType.DOUBLES,
            status: client_1.MatchStatus.CONFIRMED,
            scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            finishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            scoreA: 9,
            scoreB: 11,
            winner: client_1.WinnerTeam.TEAM_B,
            confirmedByA: true,
            confirmedByB: true,
            teamA: [MAIN_USER_ID, PLAYER_02_ID],
            teamB: [PLAYER_01_ID, PLAYER_03_ID],
            playSessionId: SESSION_COMPLETED_ID,
            createdById: MAIN_USER_ID,
        },
        create: {
            id: MATCH_7_ID,
            category: client_1.MatchCategory.SOCIAL,
            matchType: client_1.MatchType.DOUBLES,
            status: client_1.MatchStatus.CONFIRMED,
            scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            finishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            scoreA: 9,
            scoreB: 11,
            winner: client_1.WinnerTeam.TEAM_B,
            confirmedByA: true,
            confirmedByB: true,
            teamA: [MAIN_USER_ID, PLAYER_02_ID],
            teamB: [PLAYER_01_ID, PLAYER_03_ID],
            playSessionId: SESSION_COMPLETED_ID,
            createdById: MAIN_USER_ID,
        },
    });
    await prisma.match.upsert({
        where: { id: MATCH_8_ID },
        update: {
            category: client_1.MatchCategory.SOCIAL,
            matchType: client_1.MatchType.SINGLES,
            status: client_1.MatchStatus.CONFIRMED,
            scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            finishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            scoreA: 11,
            scoreB: 7,
            winner: client_1.WinnerTeam.TEAM_A,
            confirmedByA: true,
            confirmedByB: true,
            teamA: [MAIN_USER_ID],
            teamB: [PLAYER_01_ID],
            playSessionId: SESSION_COMPLETED_ID,
            createdById: MAIN_USER_ID,
        },
        create: {
            id: MATCH_8_ID,
            category: client_1.MatchCategory.SOCIAL,
            matchType: client_1.MatchType.SINGLES,
            status: client_1.MatchStatus.CONFIRMED,
            scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            finishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            scoreA: 11,
            scoreB: 7,
            winner: client_1.WinnerTeam.TEAM_A,
            confirmedByA: true,
            confirmedByB: true,
            teamA: [MAIN_USER_ID],
            teamB: [PLAYER_01_ID],
            playSessionId: SESSION_COMPLETED_ID,
            createdById: MAIN_USER_ID,
        },
    });
    await prisma.match.upsert({
        where: { id: MATCH_9_ID },
        update: {
            category: client_1.MatchCategory.SOCIAL,
            matchType: client_1.MatchType.SINGLES,
            status: client_1.MatchStatus.CONFIRMED,
            scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            finishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            scoreA: 10,
            scoreB: 10,
            winner: client_1.WinnerTeam.DRAW,
            confirmedByA: true,
            confirmedByB: true,
            teamA: [PLAYER_02_ID],
            teamB: [PLAYER_03_ID],
            playSessionId: SESSION_COMPLETED_ID,
            createdById: MAIN_USER_ID,
        },
        create: {
            id: MATCH_9_ID,
            category: client_1.MatchCategory.SOCIAL,
            matchType: client_1.MatchType.SINGLES,
            status: client_1.MatchStatus.CONFIRMED,
            scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            finishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            courtId: SPORT_CENTER_COURT_1_ID,
            scoreA: 10,
            scoreB: 10,
            winner: client_1.WinnerTeam.DRAW,
            confirmedByA: true,
            confirmedByB: true,
            teamA: [PLAYER_02_ID],
            teamB: [PLAYER_03_ID],
            playSessionId: SESSION_COMPLETED_ID,
            createdById: MAIN_USER_ID,
        },
    });
    console.log('Match seeding completed.');
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (error) => {
    console.error('Failed to seed', error);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map