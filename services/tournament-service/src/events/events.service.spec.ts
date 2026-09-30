import { Test, TestingModule } from '@nestjs/testing';
import { EventsService } from './events.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventStage } from './dto/event-response.dto';
import { EventStatus, MatchStatus } from '@prisma/client';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      team: {
        count: jest.fn().mockResolvedValue(0),
      },
      match: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      tournamentEvent: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  describe('enrichEvent currentStage calculation', () => {
    const mockEvent = {
      id: 10,
      name: 'Mixed Doubles 4.0',
      numGroups: 4,
      totalAdvance: 8,
      status: EventStatus.open,
      tournamentId: 1,
    };

    it('returns registration stage when there are no matches', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce(mockEvent);
      prisma.match.findMany.mockResolvedValueOnce([]);

      const result = await service.findOne(1, 10);
      expect(result.currentStage).toBe(EventStage.REGISTRATION);
    });

    it('returns group_stage when some group matches are pending', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce(mockEvent);
      prisma.match.findMany.mockResolvedValueOnce([
        { groupStage: true, status: MatchStatus.completed },
        { groupStage: true, status: MatchStatus.scheduled },
      ]);

      const result = await service.findOne(1, 10);
      expect(result.currentStage).toBe(EventStage.GROUP_STAGE);
    });

    it('returns knockout_ready when group stage matches are all completed but bracket is not generated yet', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce(mockEvent);
      prisma.match.findMany.mockResolvedValueOnce([
        { groupStage: true, status: MatchStatus.completed },
        { groupStage: true, status: MatchStatus.walkover },
      ]); // no groupStage: false matches

      const result = await service.findOne(1, 10);
      expect(result.currentStage).toBe(EventStage.KNOCKOUT_READY);
    });

    it('returns knockout_stage when group stage matches are completed and bracket matches are pending', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce(mockEvent);
      prisma.match.findMany.mockResolvedValueOnce([
        { groupStage: true, status: MatchStatus.completed },
        { groupStage: false, status: MatchStatus.scheduled },
      ]);

      const result = await service.findOne(1, 10);
      expect(result.currentStage).toBe(EventStage.KNOCKOUT_STAGE);
    });

    it('returns completed when all matches (both group and knockout) are completed', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce(mockEvent);
      prisma.match.findMany.mockResolvedValueOnce([
        { groupStage: true, status: MatchStatus.completed },
        { groupStage: false, status: MatchStatus.completed },
      ]);

      const result = await service.findOne(1, 10);
      expect(result.currentStage).toBe(EventStage.COMPLETED);
    });
  });

  describe('enrichEvent totalMatches calculation', () => {
    it('returns null if numGroups or totalAdvance is not set', async () => {
      const mockEventNoConfig = {
        id: 10,
        name: 'Mixed Doubles 4.0',
        status: EventStatus.open,
        tournamentId: 1,
      };
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce(mockEventNoConfig);
      prisma.match.findMany.mockResolvedValueOnce([]);

      const result = await service.findOne(1, 10);
      expect(result.totalMatches).toBeNull();
    });

    it('returns correct totalMatches when configured and teamCount >= 2', async () => {
      const mockEvent = {
        id: 10,
        name: 'Mixed Doubles 4.0',
        numGroups: 3,
        totalAdvance: 8,
        status: EventStatus.open,
        tournamentId: 1,
      };
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce(mockEvent);
      prisma.team.count.mockResolvedValueOnce(8); // 8 teams
      prisma.match.findMany.mockResolvedValueOnce([]);

      const result = await service.findOne(1, 10);
      // numGroups = 3, teamCount = 8.
      // Groups sizes: 3, 3, 2 (8 % 3 = 2 extra teams, so two groups of size 3, one group of size 2)
      // Group matches:
      // Group 1 (size 3): 3 * 2 / 2 = 3 matches
      // Group 2 (size 3): 3 * 2 / 2 = 3 matches
      // Group 3 (size 2): 2 * 1 / 2 = 1 match
      // Total group matches: 3 + 3 + 1 = 7 matches
      // Knockout: totalAdvance = 8, nextPow2 = 8, knockout matches = 7
      // Total predicted matches = 7 + 7 = 14 matches
      expect(result.totalMatches).toBe(14);
    });

    it('returns 0 if teamCount < 2', async () => {
      const mockEvent = {
        id: 10,
        name: 'Mixed Doubles 4.0',
        numGroups: 3,
        totalAdvance: 8,
        status: EventStatus.open,
        tournamentId: 1,
      };
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce(mockEvent);
      prisma.team.count.mockResolvedValueOnce(1); // 1 team
      prisma.match.findMany.mockResolvedValueOnce([]);

      const result = await service.findOne(1, 10);
      expect(result.totalMatches).toBe(0);
    });
  });
});
