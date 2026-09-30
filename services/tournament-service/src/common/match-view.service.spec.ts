import { Test, TestingModule } from '@nestjs/testing';
import { MatchViewService } from './match-view.service';
import { PrismaService } from '../prisma/prisma.service';
import { SportCenterClient } from '../clients/sport-center.client';

const EXT = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
const ITEM = 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f';

describe('MatchViewService', () => {
  let service: MatchViewService;
  let prisma: any;
  let sc: any;

  const teamA = {
    id: 100,
    player1Id: 'p1',
    player1Name: 'Alice',
    player1Rating: 4.2,
    player1Gender: 'M',
    player1DuprId: null,
    player2Id: 'p2',
    player2Name: 'Bob',
    player2Rating: 4.2,
    player2Gender: 'M',
    player2DuprId: null,
    avgRating: 4.2,
  };
  const teamB = {
    id: 200,
    player1Id: 'p3',
    player1Name: 'Carol',
    player1Rating: 3.8,
    player1Gender: 'F',
    player1DuprId: null,
    player2Id: null,
    player2Name: null,
    player2Rating: null,
    player2Gender: null,
    player2DuprId: null,
    avgRating: 3.8,
  };

  beforeEach(async () => {
    prisma = {
      seed: { findMany: jest.fn().mockResolvedValue([{ teamId: 100, seed: 1 }, { teamId: 200, seed: 2 }]) },
      tournamentBooking: { findMany: jest.fn().mockResolvedValue([]) },
    };
    sc = {
      getBookingsByIds: jest.fn().mockResolvedValue(new Map()),
      getCourtsByIds: jest.fn().mockResolvedValue(new Map()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchViewService,
        { provide: PrismaService, useValue: prisma },
        { provide: SportCenterClient, useValue: sc },
      ],
    }).compile();
    service = module.get(MatchViewService);
  });

  it('returns [] for no matches without touching the DB', async () => {
    const res = await service.enrich(1, []);
    expect(res).toEqual([]);
    expect(prisma.seed.findMany).not.toHaveBeenCalled();
  });

  it('maps teams, seeds, winner (1/2) and per-team scores', async () => {
    const res = await service.enrich(1, [
      {
        id: 10,
        round: 'Final',
        team1Id: 100,
        team2Id: 200,
        team1: teamA,
        team2: teamB,
        winner: 200,
        score: '9-11',
        status: 'completed',
        event: { name: "Men's Doubles" },
        bookingId: null,
        bookingItemId: null,
      },
    ]);

    expect(res[0]).toMatchObject({
      id: 10,
      event: "Men's Doubles",
      round: 'Final',
      winner: 2,
      score: '9-11',
      team1: { teamId: 100, name: 'Alice / Bob', seed: 1, rating: 4.2, score: 9 },
      team2: { teamId: 200, name: 'Carol', seed: 2, rating: 3.8, score: 11 },
      court: null,
    });
  });

  it('resolves a scheduled fixture to its live court (name + status)', async () => {
    prisma.tournamentBooking.findMany.mockResolvedValue([{ id: 5, externalBookingId: EXT }]);
    sc.getBookingsByIds.mockResolvedValue(new Map([[EXT, { bookingItems: [{ id: ITEM, courtId: 'court-x' }] }]]));
    sc.getCourtsByIds.mockResolvedValue(new Map([['court-x', { id: 'court-x', name: 'San 1', status: 'available' }]]));

    const res = await service.enrich(1, [
      { id: 11, team1Id: 100, team2Id: 200, team1: teamA, team2: teamB, winner: null, score: null, status: 'scheduled', bookingId: 5, bookingItemId: ITEM },
    ]);

    expect(sc.getCourtsByIds).toHaveBeenCalledWith(['court-x']);
    expect(res[0]).toMatchObject({ court: 'San 1', courtId: 'court-x', courtStatus: 'available' });
  });
});
