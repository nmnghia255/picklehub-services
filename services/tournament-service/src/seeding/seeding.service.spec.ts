import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SeedingService } from './seeding.service';
import { PrismaService } from '../prisma/prisma.service';
import { RATING_PROVIDER } from './rating/rating-provider.interface';
import { ManualRatingProvider } from './rating/manual-rating.provider';

const team = (id: number, avgRating: number, p1 = `P${id}`, p2: string | null = null) => ({
  id,
  tournamentId: 't-uuid',
  eventId: 10,
  player1Id: `u${id}`,
  player1Name: p1,
  player1Rating: avgRating,
  player1Age: null,
  player1Gender: null,
  player1DuprId: null,
  player2Id: p2 ? `u${id}b` : null,
  player2Name: p2,
  player2Rating: p2 ? avgRating : null,
  player2Age: null,
  player2Gender: null,
  player2DuprId: null,
  avgRating,
});

const seedRow = (seed: number, teamId: number, status = 'unlocked') => ({
  id: seed,
  tournamentId: 1,
  eventId: 10,
  seed,
  teamId,
  teamName: `P${teamId}`,
  rating: 4,
  wins: 0,
  losses: 0,
  status,
});

describe('SeedingService', () => {
  let service: SeedingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      tournamentEvent: { findFirst: jest.fn().mockResolvedValue({ id: 10, tournamentId: 1 }) },
      team: { findMany: jest.fn() },
      seed: {
        findMany: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (arg: any) =>
        typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedingService,
        { provide: PrismaService, useValue: prisma },
        { provide: RATING_PROVIDER, useClass: ManualRatingProvider },
      ],
    }).compile();

    service = module.get<SeedingService>(SeedingService);
  });

  describe('generate', () => {
    it('ranks teams by rating desc, breaking ties by team id, and writes seeds 1..n', async () => {
      prisma.seed.findMany
        .mockResolvedValueOnce([]) // existing (not locked)
        .mockResolvedValueOnce([seedRow(1, 1), seedRow(2, 3), seedRow(3, 2)]); // list() after write
      prisma.team.findMany.mockResolvedValue([
        team(2, 3.0),
        team(1, 4.0),
        team(3, 4.0), // tie with team 1 → team 1 first (lower id)
      ]);

      await service.generate(1, 10);

      const payload = prisma.seed.createMany.mock.calls[0][0].data;
      expect(payload.map((s: any) => [s.seed, s.teamId])).toEqual([
        [1, 1],
        [2, 3],
        [3, 2],
      ]);
      expect(prisma.seed.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: 1, eventId: 10 } });
    });

    it('throws when there are no teams to seed', async () => {
      prisma.seed.findMany.mockResolvedValueOnce([]);
      prisma.team.findMany.mockResolvedValue([]);
      await expect(service.generate(1, 10)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when seeding is already locked', async () => {
      prisma.seed.findMany.mockResolvedValueOnce([seedRow(1, 1, 'locked')]);
      await expect(service.generate(1, 10)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the event does not belong to the tournament', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce(null);
      await expect(service.generate(1, 10)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('applies a full permutation in one transaction', async () => {
      prisma.seed.findMany
        .mockResolvedValueOnce([seedRow(1, 1), seedRow(2, 2)]) // current
        .mockResolvedValueOnce([seedRow(1, 2), seedRow(2, 1)]); // list() after
      await service.reorder(1, 10, { seeds: [{ teamId: 2, seed: 1 }, { teamId: 1, seed: 2 }] });
      expect(prisma.seed.updateMany).toHaveBeenCalledTimes(2);
    });

    it('rejects an incomplete ordering', async () => {
      prisma.seed.findMany.mockResolvedValueOnce([seedRow(1, 1), seedRow(2, 2)]);
      await expect(
        service.reorder(1, 10, { seeds: [{ teamId: 1, seed: 1 }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate seed position', async () => {
      prisma.seed.findMany.mockResolvedValueOnce([seedRow(1, 1), seedRow(2, 2)]);
      await expect(
        service.reorder(1, 10, { seeds: [{ teamId: 1, seed: 1 }, { teamId: 2, seed: 1 }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects reorder when locked', async () => {
      prisma.seed.findMany.mockResolvedValueOnce([seedRow(1, 1, 'locked'), seedRow(2, 2, 'locked')]);
      await expect(
        service.reorder(1, 10, { seeds: [{ teamId: 1, seed: 1 }, { teamId: 2, seed: 2 }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('lock', () => {
    it('locks all seeds for the event', async () => {
      prisma.seed.count.mockResolvedValue(4);
      prisma.seed.findMany.mockResolvedValueOnce([seedRow(1, 1, 'locked')]);
      await service.lock(1, 10);
      expect(prisma.seed.updateMany).toHaveBeenCalledWith({
        where: { tournamentId: 1, eventId: 10 },
        data: { status: 'locked' },
      });
    });

    it('throws when there are no seeds to lock', async () => {
      prisma.seed.count.mockResolvedValue(0);
      await expect(service.lock(1, 10)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('list', () => {
    it('maps teamName → team and wraps in { data, meta }', async () => {
      prisma.seed.findMany.mockResolvedValueOnce([seedRow(1, 5)]);
      const res = await service.list(1, 10);
      expect(res.meta).toEqual({ total: 1 });
      expect(res.data[0]).toMatchObject({ seed: 1, teamId: 5, team: 'P5', status: 'unlocked' });
    });
  });
});
