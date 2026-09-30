import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RunService } from './run.service';
import { PrismaService } from '../prisma/prisma.service';
import { MatchClient } from '../clients/match.client';
import { SportCenterClient } from '../clients/sport-center.client';
import { AdvancementService } from '../advancement/advancement.service';
import { MatchViewService } from '../common/match-view.service';
import { NotificationClient } from '../clients/notification.client';

const UUID = '11111111-1111-4111-8111-111111111111';
const EXT_BOOKING = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
const ITEM = 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f';
const COURT = 'f21ddb56-dd63-4e92-9b01-e3bc6784b972';
const EXT_MATCH = 'e0000001-e000-4000-8000-000000000001';

const P1 = '33333333-3333-4333-8333-333333333333';
const P2 = '44444444-4444-4444-8444-444444444444';

function doublesFixture(over: any = {}) {
  return {
    id: 10,
    tournamentId: 1,
    eventId: 1,
    bookingId: 5,
    bookingItemId: ITEM,
    refereeId: null,
    team1Id: 100,
    team2Id: 200,
    score: null,
    status: 'scheduled',
    externalMatchId: null,
    team1: { player1Id: P1, player2Id: 'a3', },
    team2: { player1Id: P2, player2Id: 'b4' },
    event: { type: 'Doubles' },
    ...over,
  };
}

describe('RunService', () => {
  let service: RunService;
  let prisma: any;
  let match: any;
  let sc: any;
  let advancement: any;
  let matchView: any;

  beforeEach(async () => {
    prisma = {
      tournament: { findUnique: jest.fn().mockResolvedValue({ id: 1, uuid: UUID }) },
      match: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      tournamentBooking: { findMany: jest.fn().mockResolvedValue([{ id: 5, externalBookingId: EXT_BOOKING }]) },
      team: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (cb: any) => {
        if (typeof cb === 'function') return cb(prisma);
        return Promise.all(cb);
      }),
    };
    match = {
      createBatch: jest.fn(),
      confirmResult: jest.fn(),
      updateMatch: jest.fn(),
      overrideResult: jest.fn(),
      listByTournament: jest.fn().mockResolvedValue([]),
    };
    sc = { getBookingsByIds: jest.fn().mockResolvedValue(new Map()) };
    advancement = { onFixtureCompleted: jest.fn().mockResolvedValue(undefined) };
    matchView = { enrich: jest.fn(async (_t: number, rows: any[]) => rows.map((r) => ({ id: r.id, enriched: true }))) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunService,
        { provide: PrismaService, useValue: prisma },
        { provide: MatchClient, useValue: match },
        { provide: SportCenterClient, useValue: sc },
        { provide: AdvancementService, useValue: advancement },
        { provide: MatchViewService, useValue: matchView },
        {
          provide: NotificationClient,
          useValue: {
            getUserEmail: jest.fn(async (id) => `mock-${id}@example.com`),
            sendEmail: jest.fn(async () => true),
          },
        },
      ],
    }).compile();
    service = module.get(RunService);
  });

  describe('dispatchFixtures', () => {
    const liveBooking = () =>
      new Map([[EXT_BOOKING, { date: '2026-06-20T00:00:00.000Z', bookingItems: [{ id: ITEM, courtId: COURT, startTime: '17:00' }] }]]);

    it('dispatches a ready fixture with the tournament uuid and stores the match id', async () => {
      prisma.match.findMany.mockResolvedValue([doublesFixture()]);
      sc.getBookingsByIds.mockResolvedValue(liveBooking());
      match.createBatch.mockResolvedValue([{ id: EXT_MATCH }]);
      prisma.match.update.mockResolvedValue({ id: 10, externalMatchId: EXT_MATCH, status: 'ready' });

      const res = await service.dispatchFixtures(1, 'org-1');

      expect(match.createBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          tournamentId: UUID,
          createdById: 'org-1',
          matches: [
            expect.objectContaining({ matchType: 'DOUBLES', courtId: COURT, scheduledAt: '2026-06-20T17:00:00.000Z', teamA: [P1, 'a3'], teamB: [P2, 'b4'] }),
          ],
        }),
      );
      expect(prisma.match.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { externalMatchId: EXT_MATCH, status: 'ready' } });
      expect(res.dispatched).toBe(1);
    });

    it('only considers undispatched, scheduled, fully-paired, booked fixtures', async () => {
      prisma.match.findMany.mockResolvedValue([]);
      const res = await service.dispatchFixtures(1, 'org-1');
      const where = prisma.match.findMany.mock.calls[0][0].where;
      expect(where).toEqual(
        expect.objectContaining({
          tournamentId: 1,
          externalMatchId: null,
          team1Id: { not: null },
          team2Id: { not: null },
          bookingItemId: { not: null },
        }),
      );
      expect(res).toEqual({ dispatched: 0, skipped: [], fixtures: [] });
      expect(match.createBatch).not.toHaveBeenCalled();
    });

    it('skips a fixture whose booked slot no longer resolves to a court', async () => {
      prisma.match.findMany.mockResolvedValue([doublesFixture()]);
      sc.getBookingsByIds.mockResolvedValue(new Map([[EXT_BOOKING, { date: '2026-06-20T00:00:00.000Z', bookingItems: [] }]]));

      const res = await service.dispatchFixtures(1, 'org-1');

      expect(match.createBatch).not.toHaveBeenCalled();
      expect(res.dispatched).toBe(0);
      expect(res.skipped[0].fixtureId).toBe(10);
    });

    it('skips an unsupported (Team) event type', async () => {
      prisma.match.findMany.mockResolvedValue([doublesFixture({ event: { type: 'Team' } })]);
      sc.getBookingsByIds.mockResolvedValue(liveBooking());

      const res = await service.dispatchFixtures(1, 'org-1');

      expect(res.dispatched).toBe(0);
      expect(res.skipped[0].reason).toMatch(/not supported/);
    });

    it('throws if the match service does not accept the whole batch', async () => {
      prisma.match.findMany.mockResolvedValue([doublesFixture()]);
      sc.getBookingsByIds.mockResolvedValue(liveBooking());
      match.createBatch.mockResolvedValue([]); // count mismatch

      await expect(service.dispatchFixtures(1, 'org-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404s for an unknown tournament', async () => {
      prisma.tournament.findUnique.mockResolvedValue(null);
      await expect(service.dispatchFixtures(99, 'org-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('recordResult', () => {
    it('rejects a fixture that has not been dispatched', async () => {
      prisma.match.findFirst.mockResolvedValue({ id: 10, tournamentId: 1, externalMatchId: null });
      await expect(service.recordResult(1, 10, { winner: 1 }, 'org-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('confirms and mirrors winner/score/status when CONFIRMED', async () => {
      prisma.match.findFirst.mockResolvedValue({ id: 10, tournamentId: 1, externalMatchId: EXT_MATCH, team1Id: 100, team2Id: 200, score: null });
      match.overrideResult.mockResolvedValue({ status: 'CONFIRMED', winner: 'TEAM_A', scoreA: 11, scoreB: 8 });
      prisma.match.update.mockResolvedValue({ id: 10, winner: 100, score: '11-8', status: 'completed' });

      const res = await service.recordResult(1, 10, { winner: 1, scoreA: 11, scoreB: 8 }, 'org-1', 'Bearer x');

      expect(match.overrideResult).toHaveBeenCalledWith(EXT_MATCH, { winner: 'TEAM_A', scoreA: 11, scoreB: 8 });
      expect(prisma.match.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { winner: 100, score: '11-8', status: 'completed' } });
      expect(advancement.onFixtureCompleted).toHaveBeenCalledWith(10);
      expect(res.match.status).toBe('CONFIRMED');
    });

    it('leaves the fixture untouched on a partial confirmation', async () => {
      prisma.match.findFirst.mockResolvedValue({ id: 10, tournamentId: 1, externalMatchId: EXT_MATCH, team1Id: 100, team2Id: 200, score: null });
      match.overrideResult.mockResolvedValue({ status: 'PENDING_CONFIRM' });

      const res = await service.recordResult(1, 10, { scoreA: 11, scoreB: 8 }, 'org-1');

      expect(prisma.match.update).not.toHaveBeenCalled();
      expect(res.match.status).toBe('PENDING_CONFIRM');
    });

    it('rejects when the match service returns nothing', async () => {
      prisma.match.findFirst.mockResolvedValue({ id: 10, tournamentId: 1, externalMatchId: EXT_MATCH, team1Id: 100, team2Id: 200, score: null });
      match.overrideResult.mockResolvedValue(null);
      await expect(service.recordResult(1, 10, { winner: 2 }, 'org-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('syncResults', () => {
    it('mirrors confirmed matches onto their fixtures', async () => {
      match.listByTournament.mockResolvedValue([{ id: EXT_MATCH, winner: 'TEAM_B', scoreA: 9, scoreB: 11, status: 'CONFIRMED' }]);
      prisma.match.findMany.mockResolvedValue([
        { id: 10, externalMatchId: EXT_MATCH, team1Id: 100, team2Id: 200, score: null, status: 'ready', winner: null },
      ]);
      prisma.match.update.mockResolvedValue({ id: 10, winner: 200, score: '9-11', status: 'completed' });

      const res = await service.syncResults(1);

      expect(match.listByTournament).toHaveBeenCalledWith(UUID);
      expect(prisma.match.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { winner: 200, score: '9-11', status: 'completed' } });
      expect(res.synced).toBe(1);
    });

    it('does nothing when no confirmed matches exist', async () => {
      match.listByTournament.mockResolvedValue([]);
      const res = await service.syncResults(1);
      expect(res).toEqual({ synced: 0, fixtures: [] });
      expect(prisma.match.update).not.toHaveBeenCalled();
    });

    it('skips a fixture already in sync', async () => {
      match.listByTournament.mockResolvedValue([{ id: EXT_MATCH, winner: 'TEAM_A', scoreA: 11, scoreB: 8, status: 'CONFIRMED' }]);
      prisma.match.findMany.mockResolvedValue([
        { id: 10, externalMatchId: EXT_MATCH, team1Id: 100, team2Id: 200, score: '11-8', status: 'completed', winner: 100 },
      ]);

      const res = await service.syncResults(1);

      expect(prisma.match.update).not.toHaveBeenCalled();
      expect(res.synced).toBe(0);
    });
  });
});
