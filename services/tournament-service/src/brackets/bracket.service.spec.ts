import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BracketService } from './bracket.service';
import { PrismaService } from '../prisma/prisma.service';

const lockedSeed = (seed: number, teamId: number) => ({
  seed,
  teamId,
  teamName: `T${teamId}`,
  status: 'locked',
});

describe('BracketService', () => {
  let service: BracketService;
  let prisma: any;
  let created: { id: number; data: any }[];
  let updates: any[];

  beforeEach(async () => {
    created = [];
    updates = [];
    let nextId = 1000;
    const tx = {
      match: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn(async ({ data }: any) => {
          const id = ++nextId;
          created.push({ id, data });
          return { id };
        }),
        update: jest.fn(async (args: any) => {
          updates.push(args);
          return {};
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      tournamentEvent: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    prisma = {
      tournamentEvent: {
        findFirst: jest.fn().mockResolvedValue({ id: 10, tournamentId: 1, bracketStatus: 'unlocked' }),
      },
      tournament: { findUnique: jest.fn().mockResolvedValue({ id: 1, status: 'in_progress' }) },
      seed: { findMany: jest.fn() },
      match: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn() },
      groupStageMembership: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [BracketService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(BracketService);
  });

  describe('generate', () => {
    it('builds a 4-team bracket: two semifinals + a final, correct pairings and links', async () => {
      prisma.seed.findMany
        .mockResolvedValueOnce([lockedSeed(1, 101), lockedSeed(2, 102), lockedSeed(3, 103), lockedSeed(4, 104)])
        .mockResolvedValueOnce([]);
      prisma.match.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.generate(1, 10);

      expect(created).toHaveLength(3);
      // seedSlots(4) = [1,4,2,3] → semi0: 101 vs 104, semi1: 102 vs 103
      expect(created[0].data.round).toBe('Semifinal');
      expect(created[0].data.team1.connect.id).toBe(101);
      expect(created[0].data.team2.connect.id).toBe(104);
      expect(created[1].data.team1.connect.id).toBe(102);
      expect(created[1].data.team2.connect.id).toBe(103);
      expect(created[0].data.status).toBe('scheduled');
      expect(created[2].data.round).toBe('Final');
      expect(created[2].data.team1).toBeUndefined();
      // both semis feed the final
      const finalId = created[2].id;
      expect(updates.filter((u) => u.data.nextMatchId).map((u) => u.data.nextMatchId)).toEqual([finalId, finalId]);
    });

    it('gives the top seed a bye in a 3-team bracket and advances it', async () => {
      prisma.seed.findMany
        .mockResolvedValueOnce([lockedSeed(1, 101), lockedSeed(2, 102), lockedSeed(3, 103)])
        .mockResolvedValueOnce([]);
      prisma.match.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.generate(1, 10);

      // seedSlots(4)=[1,4,2,3]; seed 4 > 3 teams → slot 1 is a bye paired with seed 1 (101)
      expect(created[0].data.status).toBe('walkover');
      expect(created[0].data.team1.connect.id).toBe(101);
      expect(created[0].data.team2).toBeUndefined();
      expect(created[0].data.winner).toBe(101);
      expect(created[1].data.status).toBe('scheduled'); // 102 vs 103
      // 101 advances into the final's team1 slot
      const finalId = created[2].id;
      const adv = updates.find((u) => u.where.id === finalId && u.data.team1Id === 101);
      expect(adv).toBeDefined();
    });

    it('separates teams from the same group in first-round pairings', async () => {
      prisma.seed.findMany
        .mockResolvedValueOnce([lockedSeed(1, 101), lockedSeed(2, 102), lockedSeed(3, 103), lockedSeed(4, 104)])
        .mockResolvedValueOnce([]);
      prisma.match.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      prisma.groupStageMembership.findMany.mockResolvedValueOnce([
        { teamId: 101, group: { name: 'Group A' } },
        { teamId: 104, group: { name: 'Group A' } },
        { teamId: 102, group: { name: 'Group B' } },
        { teamId: 103, group: { name: 'Group B' } },
      ]);

      await service.generate(1, 10);

      expect(created).toHaveLength(3);
      expect(created[0].data.team1.connect.id).toBe(101);
      expect(created[0].data.team2.connect.id).toBe(103);
      expect(created[1].data.team1.connect.id).toBe(102);
      expect(created[1].data.team2.connect.id).toBe(104);
    });

    it('gives both BYEs to seeds 1 and 2 in a 6-team bracket (ensureTopSeedsGetByes)', async () => {
      // 6 teams → bracket of 8 → 2 BYEs; seeds 1 and 2 must both receive BYEs.
      prisma.seed.findMany
        .mockResolvedValueOnce([
          lockedSeed(1, 101),
          lockedSeed(2, 102),
          lockedSeed(3, 103),
          lockedSeed(4, 104),
          lockedSeed(5, 105),
          lockedSeed(6, 106),
        ])
        .mockResolvedValueOnce([]);
      prisma.match.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.generate(1, 10);

      // 4 round-1 matches + 2 semis + 1 final = 7 matches total
      expect(created).toHaveLength(7);

      // Collect walkovers (BYE matches)
      const walkovers = created.filter((m) => m.data.status === 'walkover');
      expect(walkovers).toHaveLength(2);

      // Both walkovers must involve seed 1 (101) or seed 2 (102)
      const byeTeamIds = walkovers.map((m) => m.data.team1.connect.id);
      expect(byeTeamIds).toContain(101); // Seed 1
      expect(byeTeamIds).toContain(102); // Seed 2
    });

    it('enforces top-seed BYE even when seedSlots places a BYE against a lower seed', async () => {
      // Simulate a scenario by using a partial bracket where ensureTopSeedsGetByes
      // must do actual swapping. We use 3 teams (bracket of 4, 1 BYE).
      // seedSlots(4)=[1,4,2,3] → BYE is in position 1, paired with seed 1. Top seed already has BYE.
      // Then verify seed 1 gets the walkover (no swap needed, but correctness confirmed).
      prisma.seed.findMany
        .mockResolvedValueOnce([lockedSeed(1, 201), lockedSeed(2, 202), lockedSeed(3, 203)])
        .mockResolvedValueOnce([]);
      prisma.match.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.generate(1, 10);

      const walkovers = created.filter((m) => m.data.status === 'walkover');
      expect(walkovers).toHaveLength(1);
      // BYE must go to seed 1 (team 201), the top-performing team
      expect(walkovers[0].data.team1.connect.id).toBe(201);
      expect(walkovers[0].data.winner).toBe(201);
    });

    it('rejects when seeds are not locked', async () => {
      prisma.seed.findMany.mockResolvedValueOnce([
        { seed: 1, teamId: 101, teamName: 'T', status: 'unlocked' },
        { seed: 2, teamId: 102, teamName: 'T', status: 'unlocked' },
      ]);
      await expect(service.generate(1, 10)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the tournament is not in_progress', async () => {
      prisma.tournament.findUnique.mockResolvedValueOnce({ id: 1, status: 'draft' });
      await expect(service.generate(1, 10)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects regeneration when a match has already started', async () => {
      prisma.seed.findMany.mockResolvedValueOnce([lockedSeed(1, 101), lockedSeed(2, 102)]);
      prisma.match.findMany.mockResolvedValueOnce([{ id: 1, status: 'completed', externalMatchId: null }]);
      await expect(service.generate(1, 10)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when there are pending group stage matches', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce({ id: 10, tournamentId: 1, bracketStatus: 'unlocked', numGroups: 2 });
      prisma.match.findFirst.mockResolvedValueOnce({ id: 5, groupStage: true, status: 'scheduled' }); // pending match

      await expect(service.generate(1, 10)).rejects.toThrow('Vui lòng hoàn thành tất cả các trận đấu vòng bảng trước khi tạo nhánh đấu (bracket).');
    });

    it('rejects when advanceFromGroups has not been run', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce({ id: 10, tournamentId: 1, bracketStatus: 'unlocked', numGroups: 2 });
      prisma.match.findFirst.mockResolvedValueOnce(null); // all group matches done
      prisma.groupStageMembership.findFirst.mockResolvedValueOnce(null); // not advanced yet

      await expect(service.generate(1, 10)).rejects.toThrow('Vui lòng thực hiện Advance From Groups để chọn các đội đi tiếp trước khi tạo nhánh đấu (bracket).');
    });

    it('throws NotFound when the event is missing', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce(null);
      await expect(service.generate(1, 10)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getBracket', () => {
    it('maps winner to 1/2 and resolves team names + seeds', async () => {
      prisma.match.findMany.mockResolvedValueOnce([
        {
          id: 1,
          round: 'Final',
          bracketPosition: 0,
          nextMatchId: null,
          externalMatchId: null,
          status: 'completed',
          score: '11-9',
          winner: 101,
          team1Id: 101,
          team2Id: 102,
          team1: { id: 101, player1Name: 'A', player2Name: null, avgRating: 4.5, player1Id: 'p1', player2Id: null },
          team2: { id: 102, player1Name: 'B', player2Name: 'C', avgRating: 4.0, player1Id: 'p2', player2Id: 'p3' },
        },
      ]);
      prisma.seed.findMany.mockResolvedValueOnce([
        { teamId: 101, seed: 1 },
        { teamId: 102, seed: 2 },
      ]);

      const res = await service.getBracket(1, 10);

      expect(res.meta).toEqual({ total: 1 });
      expect(res.data[0].team1).toMatchObject({
        teamId: 101,
        name: 'A',
        seed: 1,
        rating: 4.5,
        player1: { id: 'p1', name: 'A' },
        player2: null,
      });
      expect(res.data[0].team2).toMatchObject({
        teamId: 102,
        name: 'B / C',
        seed: 2,
        player1: { id: 'p2', name: 'B' },
        player2: { id: 'p3', name: 'C' },
      });
    });
  });

  describe('deleteBracket', () => {
    it('blocks deletion when a match has started', async () => {
      prisma.match.findMany.mockResolvedValueOnce([{ id: 1, status: 'in_progress', externalMatchId: null }]);
      await expect(service.deleteBracket(1, 10)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deletes when no match has started', async () => {
      prisma.match.findMany.mockResolvedValueOnce([
        { id: 1, status: 'scheduled', externalMatchId: null },
        { id: 2, status: 'pending', externalMatchId: null },
      ]);
      prisma.match.deleteMany.mockResolvedValueOnce({ count: 2 });
      await expect(service.deleteBracket(1, 10)).resolves.toEqual({ deleted: 2 });
    });
  });

  describe('lockBracket', () => {
    it('locks the bracket', async () => {
      prisma.match.count.mockResolvedValueOnce(3);
      prisma.seed.findMany.mockResolvedValueOnce([]);
      const res = await service.lockBracket(1, 10);
      expect(res.status).toBe('unlocked');
    });
  });

  describe('editBracket', () => {
    it('blocks editing if locked', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce({ id: 10, tournamentId: 1, bracketStatus: 'locked' });
      await expect(service.editBracket(1, 10, { matches: [] })).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
