import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdvancementService } from './advancement.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrizesService } from '../prizes/prizes.service';
import { GroupStageService } from '../group-stage/group-stage.service';

describe('AdvancementService', () => {
  let service: AdvancementService;
  let prisma: any;
  let prizes: any;

  beforeEach(async () => {
    prisma = {
      tournament: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      tournamentEvent: { findFirst: jest.fn().mockResolvedValue({ id: 1 }), findMany: jest.fn().mockResolvedValue([{ id: 1 }]) },
      seed: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      match: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
      prize: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (arg: any) => {
        if (typeof arg === 'function') return arg(prisma);
        return Promise.all(arg);
      }),
    };
    prizes = { awardPrize: jest.fn().mockResolvedValue({}) };
    const mockGroupStageService = {
      recomputeGroupStandings: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvancementService,
        { provide: PrismaService, useValue: prisma },
        { provide: PrizesService, useValue: prizes },
        { provide: GroupStageService, useValue: mockGroupStageService },
      ],
    }).compile();
    service = module.get(AdvancementService);
  });

  describe('onFixtureCompleted', () => {
    it('does nothing for a fixture without a winner', async () => {
      prisma.match.findUnique.mockResolvedValue({ id: 5, winner: null });
      await service.onFixtureCompleted(5);
      expect(prisma.match.update).not.toHaveBeenCalled();
    });

    it('recomputes seed records and pushes the winner into the next match slot', async () => {
      // Round-1 match (bracketPosition 0) won by team 100, feeds match 20 (still open).
      prisma.match.findUnique
        .mockResolvedValueOnce({ id: 10, tournamentId: 1, eventId: 1, winner: 100, team1Id: 100, team2Id: 200, nextMatchId: 20, bracketPosition: 0 })
        .mockResolvedValueOnce({ id: 20, team1Id: null, team2Id: null, status: 'pending', externalMatchId: null });
      prisma.seed.findMany.mockResolvedValue([
        { id: 1, teamId: 100 },
        { id: 2, teamId: 200 },
      ]);
      prisma.match.findMany.mockResolvedValue([{ team1Id: 100, team2Id: 200, winner: 100 }]);

      await service.onFixtureCompleted(10);

      // wins/losses recomputed
      expect(prisma.seed.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { wins: 1, losses: 0 } });
      expect(prisma.seed.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { wins: 0, losses: 1 } });
      // even feeder position → team1 slot of the next match
      expect(prisma.match.update).toHaveBeenCalledWith({ where: { id: 20 }, data: { team1Id: 100 } });
    });

    it('marks the next match scheduled once both slots are filled', async () => {
      prisma.match.findUnique
        .mockResolvedValueOnce({ id: 11, tournamentId: 1, eventId: 1, winner: 300, team1Id: 300, team2Id: 400, nextMatchId: 20, bracketPosition: 1 })
        .mockResolvedValueOnce({ id: 20, team1Id: 100, team2Id: null, status: 'pending', externalMatchId: null });
      prisma.seed.findMany.mockResolvedValue([]);
      prisma.match.findMany.mockResolvedValue([]);

      await service.onFixtureCompleted(11);

      // odd feeder position → team2 slot, and both teams now present → scheduled
      expect(prisma.match.update).toHaveBeenCalledWith({ where: { id: 20 }, data: { team2Id: 300, status: 'scheduled' } });
    });

    it('does not disturb a next match that has already been dispatched', async () => {
      prisma.match.findUnique
        .mockResolvedValueOnce({ id: 12, tournamentId: 1, eventId: 1, winner: 100, team1Id: 100, team2Id: 200, nextMatchId: 20, bracketPosition: 0 })
        .mockResolvedValueOnce({ id: 20, team1Id: 100, team2Id: 200, status: 'scheduled', externalMatchId: 'already-out' });
      prisma.seed.findMany.mockResolvedValue([]);
      prisma.match.findMany.mockResolvedValue([]);

      await service.onFixtureCompleted(12);

      expect(prisma.match.update).not.toHaveBeenCalled(); // only seed.update may run (none here)
    });



    describe('final reached', () => {
      const final = { id: 30, tournamentId: 1, eventId: 1, winner: 100, team1Id: 100, team2Id: 200, nextMatchId: null, bracketPosition: 0 };

      beforeEach(() => {
        prisma.match.findUnique.mockResolvedValue(final);
        prisma.seed.findMany.mockResolvedValue([]);
        prisma.match.findMany.mockResolvedValue([]);
      });

      it('auto-awards the top prizes to champion then runner-up', async () => {
        prisma.prize.findMany.mockResolvedValue([
          { id: 1, value: 100, winnerTeamId: null, createdAt: new Date('2026-01-01') },
          { id: 2, value: 500, winnerTeamId: null, createdAt: new Date('2026-01-01') },
        ]);
        prisma.tournament.findUnique.mockResolvedValue({ id: 1, status: 'in_progress' });
        prisma.match.findFirst.mockResolvedValue({ winner: 100 }); // event final decided

        await service.onFixtureCompleted(30);

        // highest value (id 2) → champion 100, next (id 1) → runner-up 200
        expect(prizes.awardPrize).toHaveBeenCalledWith(1, 2, 100);
        expect(prizes.awardPrize).toHaveBeenCalledWith(1, 1, 200);
      });

      it('backs off auto-award when a prize was awarded manually', async () => {
        prisma.prize.findMany.mockResolvedValue([{ id: 1, value: 500, winnerTeamId: 999, createdAt: new Date() }]);
        prisma.tournament.findUnique.mockResolvedValue({ id: 1, status: 'in_progress' });
        prisma.match.findFirst.mockResolvedValue({ winner: 100 });

        await service.onFixtureCompleted(30);

        expect(prizes.awardPrize).not.toHaveBeenCalled();
      });

      it('completes the tournament once every event final is decided', async () => {
        prisma.prize.findMany.mockResolvedValue([]);
        prisma.tournament.findUnique.mockResolvedValue({ id: 1, status: 'in_progress' });
        prisma.tournamentEvent.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        prisma.match.findFirst.mockResolvedValue({ winner: 100 }); // both finals decided

        await service.onFixtureCompleted(30);

        expect(prisma.tournament.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: 'completed' } });
      });

      it('does not complete the tournament when an event final is unfinished', async () => {
        prisma.prize.findMany.mockResolvedValue([]);
        prisma.tournament.findUnique.mockResolvedValue({ id: 1, status: 'in_progress' });
        prisma.tournamentEvent.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        prisma.match.findFirst.mockResolvedValueOnce({ winner: 100 }).mockResolvedValueOnce({ winner: null });

        await service.onFixtureCompleted(30);

        expect(prisma.tournament.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('getStandings', () => {
    it('ranks champion, runner-up, then the rest by wins', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 1 });
      prisma.seed.findMany.mockResolvedValue([
        { teamId: 100, teamName: 'A', seed: 1 },
        { teamId: 200, teamName: 'B', seed: 2 },
        { teamId: 300, teamName: 'C', seed: 3 },
        { teamId: 400, teamName: 'D', seed: 4 },
      ]);
      prisma.match.findMany.mockResolvedValue([
        // semifinals
        { team1Id: 100, team2Id: 400, winner: 100, round: 'Semifinal', nextMatchId: 3, status: 'completed' },
        { team1Id: 200, team2Id: 300, winner: 200, round: 'Semifinal', nextMatchId: 3, status: 'completed' },
        // final
        { team1Id: 100, team2Id: 200, winner: 100, round: 'Final', nextMatchId: null, status: 'completed' },
      ]);

      const res = await service.getStandings(1, 1);

      expect(res.meta.championTeamId).toBe(100);
      expect(res.meta.championTeamName).toBe('A');
      expect(res.data[0]).toMatchObject({ position: 1, teamId: 100, result: 'Champion', wins: 2, losses: 0 });
      expect(res.data[1]).toMatchObject({ position: 2, teamId: 200, result: 'Runner-up', wins: 1, losses: 1 });
      expect(res.data[2].result).toMatch(/Semifinal/);
    });



    it('404s for an unknown event', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue(null);
      await expect(service.getStandings(1, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
