import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GroupStageService } from './group-stage.service';
import { PrismaService } from '../prisma/prisma.service';
import { MatchStatus } from '@prisma/client';
import { UserClient } from '../clients/user.client';
import { NotificationClient } from '../clients/notification.client';
import { EventsService } from '../events/events.service';

describe('GroupStageService', () => {
  let service: GroupStageService;
  let prisma: any;
  let userClient: any;
  let notificationClient: any;
  let eventsServiceMock: any;

  beforeEach(async () => {
    eventsServiceMock = {
      findOne: jest.fn(),
    };
    prisma = {
      $transaction: jest.fn((cb) => cb(prisma)),
      tournament: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
      tournamentEvent: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      match: {
        findFirst: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      seed: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      team: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      groupStageGroup: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      groupStageMembership: {
        createMany: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    userClient = {
      getBatchProfiles: jest.fn().mockResolvedValue([]),
    };

    notificationClient = {
      frontendUrl: 'http://localhost:3000',
      sendEmail: jest.fn().mockResolvedValue(true),
      sendInAppNotification: jest.fn().mockResolvedValue(true),
      getUserEmail: jest.fn().mockResolvedValue('test@example.com'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupStageService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserClient, useValue: userClient },
        { provide: NotificationClient, useValue: notificationClient },
        { provide: EventsService, useValue: eventsServiceMock },
      ],
    }).compile();

    service = module.get<GroupStageService>(GroupStageService);
  });

  describe('configure', () => {
    it('throws NotFoundException if event does not exist', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue(null);
      await expect(service.configure(1, 999, { numGroups: 3 })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if groups have already been drawn', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 1 });
      prisma.groupStageGroup.findFirst.mockResolvedValueOnce({ id: 5 });

      await expect(service.configure(1, 1, { numGroups: 3 })).rejects.toThrow(
        new BadRequestException('Cannot configure group stage: groups have already been drawn.')
      );
    });

    it('throws BadRequestException if matches have already started', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 1 });
      prisma.groupStageGroup.findFirst.mockResolvedValueOnce(null);
      prisma.match.findFirst.mockResolvedValue({ id: 10, status: MatchStatus.in_progress });

      await expect(service.configure(1, 1, { numGroups: 3 })).rejects.toThrow(BadRequestException);
    });

    it('updates tournament event config successfully', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 1 });
      prisma.groupStageGroup.findFirst.mockResolvedValueOnce(null);
      prisma.match.findFirst.mockResolvedValue(null);
      prisma.tournamentEvent.update.mockResolvedValue({ id: 1, numGroups: 3, totalAdvance: 8 });
      eventsServiceMock.findOne.mockResolvedValue({ id: 1, numGroups: 3, totalAdvance: 8, totalMatches: 15 });

      const res = await service.configure(1, 1, { numGroups: 3, totalAdvance: 8 });
      expect(res.numGroups).toBe(3);
      expect(res.totalMatches).toBe(15);
      expect(eventsServiceMock.findOne).toHaveBeenCalledWith(1, 1);
      expect(prisma.tournamentEvent.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          numGroups: 3,
          totalAdvance: 8,
          advanceMethod: 'standard',
        },
      });
    });
  });

  describe('drawGroups', () => {
    it('throws BadRequestException if seeds are not locked', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 1, numGroups: 2 });
      prisma.seed.findMany.mockResolvedValue([
        { id: 1, teamId: 101, status: 'unlocked' },
      ]);
      await expect(service.drawGroups(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if group size exceeds limit (MAX=6)', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 1, numGroups: 2 });
      // 14 seeds for 2 groups = 7 per group > 6
      const seeds = Array.from({ length: 14 }).map((_, i) => ({ id: i, teamId: i, seed: i + 1, status: 'locked' }));
      prisma.seed.findMany.mockResolvedValue(seeds);

      await expect(service.drawGroups(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if priority teams count exceeds groups count', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 1, numGroups: 2 });
      await expect(service.drawGroups(1, 1, { priorityTeamIds: [1, 2, 3] })).rejects.toThrow(BadRequestException);
    });

    it('draws groups successfully', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 1, numGroups: 2 });
      const seeds = Array.from({ length: 8 }).map((_, i) => ({ id: i, teamId: 100 + i, seed: i + 1, status: 'locked' }));
      prisma.seed.findMany.mockResolvedValue(seeds);

      prisma.groupStageGroup.create.mockImplementation((args: any) => ({ id: Math.random(), ...args.data }));
      prisma.groupStageGroup.findMany.mockResolvedValue([
        { id: 1, name: 'Group A', order: 0, memberships: [] },
        { id: 2, name: 'Group B', order: 1, memberships: [] },
      ]);

      const res = await service.drawGroups(1, 1);
      expect(prisma.groupStageGroup.deleteMany).toHaveBeenCalled();
      expect(prisma.groupStageMembership.createMany).toHaveBeenCalled();
      expect(res.length).toBe(2);
    });

    it('places priority/wildcard teams into Pot 1 successfully', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 1, numGroups: 2 });

      // 4 seeds, Team 103 is chosen as priority team
      const seeds = [
        { id: 1, teamId: 101, seed: 1, status: 'locked' },
        { id: 2, teamId: 102, seed: 2, status: 'locked' },
        { id: 3, teamId: 103, seed: 3, status: 'locked' },
        { id: 4, teamId: 104, seed: 4, status: 'locked' },
      ];
      prisma.seed.findMany.mockResolvedValue(seeds);

      prisma.groupStageGroup.create.mockImplementation((args: any) => ({ id: Math.random(), ...args.data }));
      prisma.groupStageGroup.findMany.mockResolvedValue([
        { id: 1, name: 'Group A', order: 0, memberships: [] },
        { id: 2, name: 'Group B', order: 1, memberships: [] },
      ]);

      const createManyMock = prisma.groupStageMembership.createMany;
      await service.drawGroups(1, 1, { priorityTeamIds: [103] });

      expect(createManyMock).toHaveBeenCalled();
      const generatedMemberships = createManyMock.mock.calls[0][0].data;

      // Group A and Group B should each get exactly 2 teams. 
      // Team 103 (priority) and Seed 1 (Team 101) must both be in Pot 1.
      // Therefore, Team 103 and Team 101 must end up in DIFFERENT groups!
      const team103Group = generatedMemberships.find((m: any) => m.teamId === 103).groupId;
      const team101Group = generatedMemberships.find((m: any) => m.teamId === 101).groupId;
      expect(team103Group).not.toEqual(team101Group);
    });

    it('throws BadRequestException if groups have already been drawn', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 1, numGroups: 2 });
      prisma.groupStageGroup.findFirst.mockResolvedValueOnce({ id: 5 });

      await expect(service.drawGroups(1, 1)).rejects.toThrow(
        new BadRequestException('Cannot draw groups: groups have already been drawn.')
      );
    });
  });

  describe('generateRoundRobinMatches', () => {
    it('generates round-robin matches for groups', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 1 });
      prisma.groupStageGroup.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Group A',
          memberships: [
            { teamId: 101 },
            { teamId: 102 },
            { teamId: 103 },
          ],
        },
      ]);

      await service.generateRoundRobinMatches(1, 1);

      // 3 teams = round robin has 3 matches (since round-robin circle includes bye/dummy, 3 matches total)
      // Round-robin for 3 teams (K*(K-1)/2 matches):
      // 1 vs 2, 1 vs 3, 2 vs 3.
      expect(prisma.match.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('advanceFromGroups', () => {
    it('correctly advances top teams and lucky losers', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 1, totalAdvance: 8 });
      prisma.match.findFirst.mockResolvedValue(null); // No pending matches

      // 3 groups, each has 4 teams. We take top 2 of each group = 6 teams.
      // But we specify totalAdvance = 8, so we get 2 lucky losers.
      prisma.groupStageGroup.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Group A',
          order: 0,
          memberships: [
            { teamId: 101, points: 9, gameDiff: 6, seed: 1, team: { player1Name: 'Team1' } },
            { teamId: 102, points: 6, gameDiff: 2, seed: 2, team: { player1Name: 'Team2' } },
            { teamId: 103, points: 3, gameDiff: -2, seed: 3, team: { player1Name: 'Team3' } },
            { teamId: 104, points: 0, gameDiff: -6, seed: 4, team: { player1Name: 'Team4' } },
          ],
        },
        {
          id: 2,
          name: 'Group B',
          order: 1,
          memberships: [
            { teamId: 201, points: 9, gameDiff: 5, seed: 5, team: { player1Name: 'Team5' } },
            { teamId: 202, points: 6, gameDiff: 1, seed: 6, team: { player1Name: 'Team6' } },
            { teamId: 203, points: 4, gameDiff: 0, seed: 7, team: { player1Name: 'Team7' } }, // Lucky loser 1
            { teamId: 204, points: 0, gameDiff: -6, seed: 8, team: { player1Name: 'Team8' } },
          ],
        },
        {
          id: 3,
          name: 'Group C',
          order: 2,
          memberships: [
            { teamId: 301, points: 9, gameDiff: 7, seed: 9, team: { player1Name: 'Team9' } },
            { teamId: 302, points: 6, gameDiff: 3, seed: 10, team: { player1Name: 'Team10' } },
            { teamId: 303, points: 3, gameDiff: -1, seed: 11, team: { player1Name: 'Team11' } }, // Lucky loser 2
            { teamId: 304, points: 0, gameDiff: -9, seed: 12, team: { player1Name: 'Team12' } },
          ],
        },
      ]);

      const res = await service.advanceFromGroups(1, 1);
      expect(res.advancedTeamsCount).toBe(8);

      // Verify that seed deletion and creation occurred
      expect(prisma.seed.deleteMany).toHaveBeenCalledWith({ where: { tournamentId: 1, eventId: 1 } });
      expect(prisma.seed.create).toHaveBeenCalledTimes(8);
    });
  });
});
