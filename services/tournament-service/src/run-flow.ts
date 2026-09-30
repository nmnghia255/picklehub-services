import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const PORT = process.env.PORT || 8008;
const BASE_URL = `http://localhost:${PORT}/api/tournaments`;
const TOURNAMENT_ID = 9998;
const EVENT_ID = 99981;
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-token-key-change-this-in-production';

const getRelativeDate = (daysOffset: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysOffset);
  return date.toISOString().slice(0, 10);
};

const token = jwt.sign(
  { sub: '11111111-1111-4111-8111-111111111111', role: 'organizer' },
  JWT_SECRET
);

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

import { io } from 'socket.io-client';

const startMatchInMatchService = async (externalMatchId: string) => {
  const matchServiceClient = axios.create({
    baseURL: 'http://match-service:8005',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  await matchServiceClient.patch(`/api/matches/${externalMatchId}/start`);
};

const scoreMatchViaWebsocket = (externalMatchId: string) => {
  return new Promise<void>((resolve, reject) => {
    const socket = io('http://match-service:8005/matches', {
      auth: {
        token: `Bearer ${token}`
      },
      transports: ['websocket'],
    });

    let intervalId: NodeJS.Timeout;

    socket.on('connect', () => {
      socket.emit('join-match', { matchId: externalMatchId });

      let currentSet = 1;

      socket.on('match-event', async (data: any) => {
        if (data.status === 'CONFIRMED' || data.event === 'match-completed') {
          clearInterval(intervalId);
          socket.disconnect();

          // Auto-confirm the match to move status to CONFIRMED and trigger sync-job
          try {
            const matchServiceClient = axios.create({
              baseURL: 'http://match-service:8005',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });
            await matchServiceClient.patch(`/api/matches/${externalMatchId}/confirm`, {
              winner: 'TEAM_A',
            });
          } catch (err: any) {
            console.warn(`[Auto-Confirm] Failed to auto-confirm match ${externalMatchId}: ${err.message}`);
          }

          resolve();
          return;
        }

        // Parse sets array from the broadcasted score state to advance sets dynamically
        if (data.score && Array.isArray(data.score.sets)) {
          const sets = data.score.sets;
          const currentScore = sets[currentSet - 1];
          if (currentScore) {
            const [sA, sB] = currentScore;
            if ((sA >= 11 || sB >= 11) && Math.abs(sA - sB) >= 2) {
              currentSet++;
            }
          }
        }
      });

      intervalId = setInterval(() => {
        socket.emit('score-point', {
          matchId: externalMatchId,
          setId: currentSet,
          scoringTeam: 'TEAM_A',
        });
      }, 100);
    });

    socket.on('connect_error', (err: any) => {
      clearInterval(intervalId);
      socket.disconnect();
      reject(err);
    });

    socket.on('error', (err: any) => {
      clearInterval(intervalId);
      socket.disconnect();
      reject(err);
    });
  });
};

async function run() {
  console.log('=== STARTING TOURNAMENT FLOW TEST RUN ===');

  const relativeDate21 = getRelativeDate(21);
  console.log(`Relative Date (21 days offset): ${relativeDate21}`);

  try {
    // Step 0: Clean up existing state for idempotent test runs
    console.log('Cleaning up existing event state from previous runs...');
    const prismaClient = new PrismaClient();
    await prismaClient.groupStageGroup.deleteMany({
      where: { eventId: EVENT_ID },
    });
    await prismaClient.match.deleteMany({
      where: { eventId: EVENT_ID },
    });
    await prismaClient.seed.deleteMany({
      where: { eventId: EVENT_ID },
    });
    await prismaClient.tournamentEvent.update({
      where: { id: EVENT_ID },
      data: {
        numGroups: null,
        totalAdvance: null,
        bracketStatus: 'unlocked',
      },
    });
    await prismaClient.tournament.update({
      where: { id: TOURNAMENT_ID },
      data: { status: 'in_progress' },
    });
    await prismaClient.$disconnect();
    console.log('✔ Cleanup complete.');

    // Step 1: Set Tournament Status to In Progress
    console.log('\n[Step 1] Setting tournament status to in_progress...');
    await client.patch(`/${TOURNAMENT_ID}/status`, { status: 'in_progress' }).catch((err) => {
      if (err.response?.data?.message?.includes('Invalid status transition')) {
        console.log('✔ Tournament is already in_progress.');
      } else {
        throw err;
      }
    });

    // Step 1.5: Enroll referee
    console.log('\n[Step 1.5] Enrolling referee...');
    {
      const prismaClient = new PrismaClient();
      await prismaClient.tournamentReferee.upsert({
        where: {
          tournamentId_refereeId: {
            tournamentId: TOURNAMENT_ID,
            refereeId: '11111111-1111-4111-8111-111111111111',
          },
        },
        update: {},
        create: {
          tournamentId: TOURNAMENT_ID,
          refereeId: '11111111-1111-4111-8111-111111111111',
          refereeName: 'Test Referee',
        },
      });
      await prismaClient.$disconnect();
    }
    console.log('✔ Referee enrolled.');

    // Step 2: Generate Seeds
    console.log('\n[Step 2] Generating seeds...');
    await client.post(`/${TOURNAMENT_ID}/events/${EVENT_ID}/seeds/generate`);
    console.log('✔ Seeds generated.');

    // Step 3: Lock Seeds
    console.log('\n[Step 3] Locking seeds...');
    await client.post(`/${TOURNAMENT_ID}/events/${EVENT_ID}/seeds/lock`);
    console.log('✔ Seeds locked.');

    // Step 4: Configure Group Stage
    console.log('\n[Step 4] Configuring group stage...');
    await client.post(`/${TOURNAMENT_ID}/events/${EVENT_ID}/group-stage/configure`, {
      numGroups: 8,
      totalAdvance: 8,
      advanceMethod: 'standard',
    });
    console.log('✔ Group stage configured.');

    // Step 5: Draw Groups
    console.log('\n[Step 5] Drawing groups...');
    await client.post(`/${TOURNAMENT_ID}/events/${EVENT_ID}/group-stage/draw`, {});
    console.log('✔ Groups drawn.');

    // Step 6: Generate Round Robin Matches
    console.log('\n[Step 6] Generating round-robin matches...');
    await client.post(`/${TOURNAMENT_ID}/events/${EVENT_ID}/group-stage/generate-matches`, {});
    console.log('✔ Group stage matches generated.');

    // Step 7: Auto-schedule Group Stage Matches
    console.log('\n[Step 7] Auto-scheduling group stage matches (Preview & Confirm)...');
    const previewRes = await client.post(`/${TOURNAMENT_ID}/events/${EVENT_ID}/auto-schedule/preview`, {
      startTime: '08:00',
      endTime: '18:00',
      matchDurationMinutes: 45,
      restDurationMinutes: 15,
      optimizationCriteria: 'balanced',
    });
    const assignments = previewRes.data.previewAssignments.map((a: any) => ({
      matchId: a.matchId,
      bookingId: a.bookingId,
      bookingItemId: a.bookingItemId,
      matchDurationMinutes: 45,
      startTime: a.startTime,
    }));
    await client.post(`/${TOURNAMENT_ID}/events/${EVENT_ID}/auto-schedule/confirm`, { assignments });
    console.log('✔ Group stage matches scheduled.');

    // Step 8: Dispatch Group Stage Matches
    console.log('\n[Step 8] Dispatching group stage matches...');
    const dispatchRes = await client.post(`/${TOURNAMENT_ID}/fixtures/dispatch`, { eventId: EVENT_ID });
    console.log(`✔ Dispatched ${dispatchRes.data.dispatched} group stage matches.`);

    // Step 9: Play and complete all Group Stage matches
    console.log('\n[Step 9] Recording results for all group stage matches...');
    const scheduleRes = await client.get(`/${TOURNAMENT_ID}/schedule`, {
      params: { eventId: EVENT_ID },
    });
    const groupMatches = scheduleRes.data.data.filter((m: any) => m.round && m.round.startsWith('Round ') && !m.round.includes('of'));
    console.log(`Found ${groupMatches.length} group stage matches.`);

    for (const match of groupMatches) {
      if (match.status !== 'completed' && match.status !== 'walkover') {
        console.log(`Assigning referee to Match ${match.id}...`);
        await client.post(`/${TOURNAMENT_ID}/matches/${match.id}/assign`, {
          refereeId: '11111111-1111-4111-8111-111111111111',
        });
        if (match.externalMatchId) {
          console.log(`Starting Match ${match.id} (external: ${match.externalMatchId}) in Match Service...`);
          await startMatchInMatchService(match.externalMatchId).catch(err => {
            console.warn(`Warning: Could not start match ${match.id}: ${err.message}`);
          });
          console.log(`Simulating point-by-point live score via WebSocket for Match ${match.id}...`);
          await scoreMatchViaWebsocket(match.externalMatchId);
          await new Promise((r) => setTimeout(r, 1000)); // wait for database sync
        }
      }
    }
    console.log('✔ All group stage matches completed.');

    // Step 9.5: Verify State Locking (Unlink block)
    console.log('\n[Step 9.5] Verifying State Locking: Attempting to unlink a completed group match...');
    const testMatch = groupMatches[0];
    try {
      await client.delete(`/${TOURNAMENT_ID}/fixtures/${testMatch.id}/booking`);
      throw new Error('State Locking failure: Unlinking a completed match should have been blocked!');
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.message === 'Cannot unlink booking for a completed match.') {
        console.log('✔ Successfully blocked unlinking of completed match (State Locking verified).');
      } else {
        throw err;
      }
    }

    // Wait until all matches are marked completed in tournament-service
    console.log('Waiting for all matches to be completed in tournament-service...');
    let pendingMatchCount = 1;
    for (let attempt = 0; attempt < 20; attempt++) {
      const scheduleRes = await client.get(`/${TOURNAMENT_ID}/schedule`, { params: { eventId: EVENT_ID } });
      const matches = scheduleRes.data.data;
      const pending = matches.filter((m: any) => m.groupStage && m.status !== 'completed' && m.status !== 'walkover');
      pendingMatchCount = pending.length;
      if (pendingMatchCount === 0) {
        break;
      }
      console.log(`Still waiting: ${pendingMatchCount} pending matches...`);
      await new Promise((r) => setTimeout(r, 200));
    }

    if (pendingMatchCount > 0) {
      throw new Error(`Cannot advance: ${pendingMatchCount} matches are still not completed after waiting.`);
    }

    // Step 10: Advance Top Teams to Knockout
    console.log('\n[Step 10] Advancing top teams to knockout...');
    const advanceRes = await client.post(`/${TOURNAMENT_ID}/events/${EVENT_ID}/group-stage/advance`, {});
    console.log(`✔ Advanced ${advanceRes.data.advancedTeamsCount} teams.`);

    // Step 11: Generate Bracket Matches
    console.log('\n[Step 11] Generating bracket matches...');
    await client.post(`/${TOURNAMENT_ID}/events/${EVENT_ID}/bracket/generate`);
    console.log('✔ Bracket matches generated.');

    // Step 12: Lock Bracket
    console.log('\n[Step 12] Locking bracket...');
    await client.post(`/${TOURNAMENT_ID}/events/${EVENT_ID}/bracket/lock`);
    console.log('✔ Bracket locked.');

    // Steps 13-15: Progressive Knockout Round execution (Round of 8, Semifinals, Finals)
    console.log('\n[Step 13-15] Executing progressive knockout rounds...');

    // 1. Auto-schedule all knockout matches once (including TBD matches)
    console.log('Auto-scheduling all knockout matches at once...');
    const previewKO = await client.post(`/${TOURNAMENT_ID}/events/${EVENT_ID}/auto-schedule/preview`, {
      startTime: '08:00',
      endTime: '18:00',
      matchDurationMinutes: 45,
      restDurationMinutes: 15,
      optimizationCriteria: 'balanced',
    });

    if (previewKO.data && previewKO.data.previewAssignments && previewKO.data.previewAssignments.length > 0) {
      const assignmentsKO = previewKO.data.previewAssignments.map((a: any) => ({
        matchId: a.matchId,
        bookingId: a.bookingId,
        bookingItemId: a.bookingItemId,
        matchDurationMinutes: 45,
        startTime: a.startTime,
      }));
      await client.post(`/${TOURNAMENT_ID}/events/${EVENT_ID}/auto-schedule/confirm`, { assignments: assignmentsKO });
      console.log(`✔ Successfully scheduled ${assignmentsKO.length} knockout matches at once.`);
    }

    let roundCount = 1;
    while (true) {
      // 2. Dispatch available matches to match-service
      const dispatchKnockout = await client.post(`/${TOURNAMENT_ID}/fixtures/dispatch`, { eventId: EVENT_ID });
      
      // 3. Fetch schedule
      const sched = await client.get(`/${TOURNAMENT_ID}/schedule`, {
        params: { eventId: EVENT_ID },
      });
      
      // Filter knockout matches
      const koMatches = sched.data.data.filter((m: any) => !m.round || !m.round.startsWith('Round ') || m.round.includes('of'));
      const pendingKO = koMatches.filter((m: any) => m.status !== 'completed' && m.status !== 'walkover');
      
      if (pendingKO.length === 0) {
        console.log('✔ All knockout matches completed.');
        break;
      }
      
      // Filter matches that are scheduled/ready and have actual team pairings
      const playableKO = pendingKO.filter((m: any) => m.team1?.teamId && m.team2?.teamId && m.status !== 'pending');
      
      if (playableKO.length === 0) {
        console.error('✘ Stalled! No playable knockout matches but pending matches exist. Check propagation logic.');
        break;
      }

      console.log(`[Round Run #${roundCount}] Playable matches: ${playableKO.map((m: any) => m.id).join(', ')}`);
      for (const m of playableKO) {
        console.log(`Assigning referee to KO Match ${m.id}...`);
        await client.post(`/${TOURNAMENT_ID}/matches/${m.id}/assign`, {
          refereeId: '11111111-1111-4111-8111-111111111111',
        });
        if (m.externalMatchId) {
          console.log(`Starting KO Match ${m.id} (external: ${m.externalMatchId}) in Match Service...`);
          await startMatchInMatchService(m.externalMatchId).catch(err => {
            console.warn(`Warning: Could not start KO match ${m.id}: ${err.message}`);
          });
          console.log(`Simulating point-by-point live score via WebSocket for KO Match ${m.id}...`);
          await scoreMatchViaWebsocket(m.externalMatchId);
          await new Promise((r) => setTimeout(r, 1000)); // wait for database sync
        }
      }
      roundCount++;
    }

    // Step 16: Complete Tournament
    console.log('\n[Step 16] Completing tournament...');
    await client.patch(`/${TOURNAMENT_ID}/status`, { status: 'completed' });
    console.log('✔ Tournament successfully completed!');

    console.log('\n=== ALL FLOW STEPS COMPLETED SUCCESSFULLY ===');
  } catch (error: any) {
    console.error('✘ Error occurred during test run:', error.response?.data || error.message || error);
    process.exit(1);
  }
}

run();
