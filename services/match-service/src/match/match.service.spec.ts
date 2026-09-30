import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MatchService } from './match.service';
import { PrismaService } from '../prisma.service';
import { MatchStatus, WinnerTeam } from '@prisma/client';
import axios from 'axios';
import { getQueueToken } from '@nestjs/bullmq';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MatchService - Livescore & Point Scoring', () => {
  let service: MatchService;
  let prisma: any;
  let queue: any;

  beforeEach(async () => {
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();

    // Default mock responses to avoid TypeError (cannot read status of undefined) in helper methods
    mockedAxios.post.mockResolvedValue({ status: 200, data: [] });
    mockedAxios.get.mockResolvedValue({ status: 200, data: [] });

    prisma = {
      match: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      matchScoreHistory: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: getQueueToken('match-sync'),
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MatchService>(MatchService);
    queue = module.get(getQueueToken('match-sync'));
  });

  describe('getRawMatch', () => {
    it('should find unique match from DB', async () => {
      const mockMatch = { id: 'm1', refereeId: 'ref1', teamA: [], teamB: [], courtId: 'c1' };
      prisma.match.findUnique.mockResolvedValue(mockMatch);

      const result = await service.getRawMatch('m1');
      expect(result).toEqual(mockMatch);
      expect(prisma.match.findUnique).toHaveBeenCalledWith({ where: { id: 'm1' } });
    });
  });

  describe('scorePoint', () => {
    it('should throw NotFoundException if match is not found', async () => {
      prisma.match.findUnique.mockResolvedValue(null);
      await expect(service.scorePoint('m1', 1, 'TEAM_A')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if match is already CONFIRMED', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'm1',
        status: MatchStatus.CONFIRMED,
        teamA: [],
        teamB: [],
        courtId: 'c1',
      });

      await expect(service.scorePoint('m1', 1, 'TEAM_A')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should score a normal point and update sets score', async () => {
      const mockMatch = {
        id: 'm1',
        status: MatchStatus.LIVE,
        startedAt: new Date(),
        finishedAt: null,
        tournamentId: 't1',
        teamA: [],
        teamB: [],
        courtId: 'c1',
      };
      prisma.match.findUnique.mockResolvedValue(mockMatch);

      // Score history has one point for TEAM_A
      const mockHistory = [
        { id: 'h1', setId: 1, scoringTeam: 'TEAM_A', timestamp: new Date() },
      ];
      prisma.matchScoreHistory.findMany.mockResolvedValue(mockHistory);
      prisma.match.update.mockImplementation((args: any) =>
        Promise.resolve({
          ...mockMatch,
          ...args.data,
        }),
      );

      const updated = await service.scorePoint('m1', 1, 'TEAM_A');

      expect(prisma.matchScoreHistory.create).toHaveBeenCalledWith({
        data: {
          matchId: 'm1',
          setId: 1,
          scoringTeam: 'TEAM_A',
        },
      });

      // Assert sets are calculated: set 1 score is 1-0
      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: expect.objectContaining({
          scoreA: 0,
          scoreB: 0,
          sets: [[1, 0]],
          status: MatchStatus.LIVE,
          winner: null,
        }),
      });
    });

    it('should end a set at 11 if leading by 2 points', async () => {
      const mockMatch = {
        id: 'm1',
        status: MatchStatus.LIVE,
        teamA: [],
        teamB: [],
        courtId: 'c1',
      };
      prisma.match.findUnique.mockResolvedValue(mockMatch);

      // Team A scores the 11th point, winning the first set 11-9 (valid USAP sequence)
      const mockHistory = Array(10).fill({ setId: 1, scoringTeam: 'TEAM_A' })
        .concat([{ setId: 1, scoringTeam: 'TEAM_B' }]) // Fault
        .concat(Array(9).fill({ setId: 1, scoringTeam: 'TEAM_B' }))
        .concat([{ setId: 1, scoringTeam: 'TEAM_A' }]) // Fault
        .concat([{ setId: 1, scoringTeam: 'TEAM_A' }]); // 11th point

      prisma.matchScoreHistory.findMany.mockResolvedValue(mockHistory);
      prisma.match.update.mockImplementation((args: any) =>
        Promise.resolve({
          ...mockMatch,
          ...args.data,
        }),
      );

      await service.scorePoint('m1', 1, 'TEAM_A');

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: expect.objectContaining({
          scoreA: 1, // 1 set won by Team A
          scoreB: 0,
          sets: [[11, 9], [0, 0]],
        }),
      });
    });

    it('should require win-by-2 if score is tied at 10-10', async () => {
      const mockMatch = {
        id: 'm1',
        status: MatchStatus.LIVE,
        teamA: [],
        teamB: [],
        courtId: 'c1',
      };
      prisma.match.findUnique.mockResolvedValue(mockMatch);

      // Score is 11-10 in set 1 (valid USAP sequence: 10-10 tied, then A gets 11th point)
      const mockHistory = Array(10).fill({ setId: 1, scoringTeam: 'TEAM_A' })
        .concat([{ setId: 1, scoringTeam: 'TEAM_B' }]) // Fault
        .concat(Array(10).fill({ setId: 1, scoringTeam: 'TEAM_B' }))
        .concat([{ setId: 1, scoringTeam: 'TEAM_A' }]) // Fault
        .concat([{ setId: 1, scoringTeam: 'TEAM_A' }]); // 11-10

      prisma.matchScoreHistory.findMany.mockResolvedValue(mockHistory);
      prisma.match.update.mockImplementation((args: any) =>
        Promise.resolve({
          ...mockMatch,
          ...args.data,
        }),
      );

      await service.scorePoint('m1', 1, 'TEAM_A');

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: expect.objectContaining({
          scoreA: 0, // No set won yet
          scoreB: 0,
          sets: [[11, 10]],
        }),
      });

      // Score becomes 12-10. Set win should be awarded.
      const mockHistoryEnd = mockHistory.concat([{ setId: 1, scoringTeam: 'TEAM_A' }]); // 12-10
      prisma.matchScoreHistory.findMany.mockResolvedValue(mockHistoryEnd);

      await service.scorePoint('m1', 1, 'TEAM_A');
      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: expect.objectContaining({
          scoreA: 1, // awarded set win
          sets: [[12, 10], [0, 0]],
        }),
      });
    });

    it('should complete match when a team wins 2 sets (best-of-3)', async () => {
      const mockMatch = {
        id: 'm1',
        status: MatchStatus.LIVE,
        tournamentId: 't1',
        teamA: [],
        teamB: [],
        courtId: 'c1',
      };
      prisma.match.findUnique.mockResolvedValue(mockMatch);

      // Team A wins Set 1 (11-9), Set 2 (11-8) in valid USAP serving sequences
      const mockHistory = Array(11).fill({ setId: 1, scoringTeam: 'TEAM_A' })
        .concat([{ setId: 1, scoringTeam: 'TEAM_B' }]) // Fault
        .concat(Array(9).fill({ setId: 1, scoringTeam: 'TEAM_B' }))
        .concat(Array(8).fill({ setId: 2, scoringTeam: 'TEAM_B' })) // Set 2: B serves first
        .concat([{ setId: 2, scoringTeam: 'TEAM_A' }]) // Fault
        .concat(Array(11).fill({ setId: 2, scoringTeam: 'TEAM_A' }));

      prisma.matchScoreHistory.findMany.mockResolvedValue(mockHistory);
      prisma.match.update.mockImplementation((args: any) =>
        Promise.resolve({
          ...mockMatch,
          ...args.data,
          status: MatchStatus.PENDING_CONFIRM,
        }),
      );
      mockedAxios.post.mockResolvedValue({ status: 200, data: {} });

      await service.scorePoint('m1', 2, 'TEAM_A');

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: expect.objectContaining({
          scoreA: 2,
          scoreB: 0,
          status: MatchStatus.PENDING_CONFIRM,
          winner: WinnerTeam.TEAM_A,
        }),
      });

      // Verify microservice integration call was NOT made because it is in PENDING_CONFIRM state
      expect(queue.add).not.toHaveBeenCalled();
    });
  });

  describe('undoPoint', () => {
    it('should throw BadRequestException if no points are recorded', async () => {
      prisma.match.findUnique.mockResolvedValue({ id: 'm1', status: MatchStatus.LIVE, teamA: [], teamB: [], courtId: 'c1' });
      prisma.matchScoreHistory.findFirst.mockResolvedValue(null);

      await expect(service.undoPoint('m1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if match is CONFIRMED', async () => {
      prisma.match.findUnique.mockResolvedValue({ id: 'm1', status: MatchStatus.CONFIRMED, teamA: [], teamB: [], courtId: 'c1' });
      await expect(service.undoPoint('m1')).rejects.toThrow(BadRequestException);
    });

    it('should delete the latest point and recalculate the score correctly', async () => {
      const mockMatch = {
        id: 'm1',
        status: MatchStatus.LIVE,
        tournamentId: 't1',
        teamA: [],
        teamB: [],
        courtId: 'c1',
      };
      prisma.match.findUnique.mockResolvedValue(mockMatch);

      const latestPoint = { id: 'h2', matchId: 'm1', setId: 1, scoringTeam: 'TEAM_A' };
      prisma.matchScoreHistory.findFirst.mockResolvedValue(latestPoint);

      // Initially had 2 points. Reverted 1, leaving 1.
      const mockRemainingHistory = [
        { id: 'h1', setId: 1, scoringTeam: 'TEAM_A', timestamp: new Date() },
      ];
      prisma.matchScoreHistory.findMany.mockResolvedValue(mockRemainingHistory);
      prisma.match.update.mockImplementation((args: any) =>
        Promise.resolve({
          ...mockMatch,
          ...args.data,
        }),
      );

      await service.undoPoint('m1');

      expect(prisma.matchScoreHistory.delete).toHaveBeenCalledWith({
        where: { id: 'h2' },
      });

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: expect.objectContaining({
          scoreA: 0,
          scoreB: 0,
          sets: [[1, 0]],
          status: MatchStatus.LIVE,
          winner: null,
        }),
      });

      // Verify microservice integration call was made via BullMQ queue
      expect(queue.add).toHaveBeenCalledWith(
        'sync-job',
        { tournamentUuid: 't1' },
        expect.any(Object),
      );
    });
  });

  describe('startMatch', () => {
    const mockMatch = {
      id: 'm1',
      status: MatchStatus.SCHEDULED,
      teamA: ['player-a1'],
      teamB: ['player-b1'],
      refereeId: 'ref1',
      courtId: 'c1',
      category: 'CUSTOM',
    };

    it('should throw BadRequestException if firstServingPlayerId does not belong to the match', async () => {
      prisma.match.findUnique.mockResolvedValue(mockMatch);
      await expect(service.startMatch('ref1', 'm1', 'invalid-player')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should successfully start a match with firstServingPlayerId belonging to teamB', async () => {
      prisma.match.findUnique.mockResolvedValue(mockMatch);
      prisma.match.update.mockImplementation((args: any) =>
        Promise.resolve({ ...mockMatch, ...args.data }),
      );

      const result = await service.startMatch('ref1', 'm1', 'player-b1');
      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: expect.objectContaining({
          status: MatchStatus.LIVE,
          firstServingPlayerId: 'player-b1',
        }),
      });
    });

    it('should successfully start a match with null firstServingPlayerId', async () => {
      prisma.match.findUnique.mockResolvedValue(mockMatch);
      prisma.match.update.mockImplementation((args: any) =>
        Promise.resolve({ ...mockMatch, ...args.data }),
      );

      await service.startMatch('ref1', 'm1');
      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: expect.objectContaining({
          status: MatchStatus.LIVE,
          firstServingPlayerId: null,
        }),
      });
    });
  });
});
