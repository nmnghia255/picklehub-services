import { Test, TestingModule } from '@nestjs/testing';
import { SocialService } from '../social.service';
import { PrismaService } from '../../prisma.service';
import { ConfigService } from '@nestjs/config';
import { SocialParticipantService } from '../participant/social-participant.service';
import { NotificationService } from '../../notification/notification.service';
import { UserService } from '../../user/user.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SocialStatus, SocialHostRole, SocialGenderPolicy, SocialAgeGroup, SocialFormat } from '@prisma/client';
import { CreateSocialDto } from '../dto/create-social.dto';
import { UpdateSocialDto } from '../dto/update-social.dto';

describe('SocialService Core Flows', () => {
  let service: SocialService;

  const mockPrisma: any = {
    social: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    socialParticipant: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
    },
    playSession: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    playSessionParticipant: {
      findMany: jest.fn(),
    },
    socialStats: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    socialFeedback: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockSocialParticipantService = {
    recalculateParticipantTotalFee: jest.fn(),
  };

  const mockNotificationService = {};
  const mockUserService = {
    getUserById: jest.fn(),
    getManyUsersByIds: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SocialParticipantService, useValue: mockSocialParticipantService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    service = module.get<SocialService>(SocialService);
  });

  describe('create', () => {
    const creatorId = '11111111-1111-4111-8111-111111111111';

    it('throws BadRequestException when creatorId is not a valid UUID', async () => {
      const dto: CreateSocialDto = { title: 'Invalid UUID Social' };
      await expect(service.create(dto, 'invalid-uuid')).rejects.toThrow(
        new BadRequestException('creatorId must be a valid UUID'),
      );
    });

    it('throws BadRequestException when minimumLevel is greater than maximumLevel', async () => {
      const dto: CreateSocialDto = {
        title: 'Level Check Social',
        minimumLevel: 4.5,
        maximumLevel: 3.5,
      };
      await expect(service.create(dto, creatorId)).rejects.toThrow(
        new BadRequestException('minimumLevel cannot be greater than maximumLevel'),
      );
    });

    it('successfully creates social and auto-joins host when hostRole is HOST_AND_PLAY', async () => {
      const dto: CreateSocialDto = {
        title: 'Morning Gathering',
        hostRole: 'HOST_AND_PLAY' as any,
      };

      const createdSocial = {
        id: 'social-123',
        title: dto.title,
        hostRole: SocialHostRole.HOST_AND_PLAY,
        joinedCount: 1,
      };

      mockPrisma.social.create.mockResolvedValue(createdSocial);
      mockPrisma.socialParticipant.create.mockResolvedValue({});

      const result = await service.create(dto, creatorId);

      expect(mockPrisma.social.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: dto.title,
            hostRole: SocialHostRole.HOST_AND_PLAY,
          }),
        }),
      );
      expect(mockPrisma.socialParticipant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            socialId: 'social-123',
            userId: creatorId,
            isHost: true,
          }),
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    const socialId = 'social-123';
    const creatorId = '11111111-1111-4111-8111-111111111111';

    it('throws NotFoundException when social does not exist', async () => {
      mockPrisma.social.findFirst.mockResolvedValue(null);
      const dto: UpdateSocialDto = { title: 'New Title' };

      await expect(service.update(socialId, dto, creatorId)).rejects.toThrow(
        new NotFoundException('Social not found'),
      );
    });

    it('throws ForbiddenException when updater is not the creator', async () => {
      const social = { id: socialId, creatorId: 'different-creator-id', status: SocialStatus.PUBLISHED };
      mockPrisma.social.findFirst.mockResolvedValue(social);
      const dto: UpdateSocialDto = { title: 'New Title' };

      await expect(service.update(socialId, dto, creatorId)).rejects.toThrow(
        new ForbiddenException('Only the creator can update this social'),
      );
    });

    it('throws BadRequestException when social is CANCELLED or COMPLETED', async () => {
      const social = { id: socialId, creatorId, status: SocialStatus.CANCELLED };
      mockPrisma.social.findFirst.mockResolvedValue(social);
      const dto: UpdateSocialDto = { title: 'New Title' };

      await expect(service.update(socialId, dto, creatorId)).rejects.toThrow(
        new BadRequestException('Cannot update this social'),
      );
    });

    it('throws BadRequestException when updating packageFee on a PUBLISHED social', async () => {
      const social = { id: socialId, creatorId, status: SocialStatus.PUBLISHED, packageFee: 100000 };
      mockPrisma.social.findFirst.mockResolvedValue(social);
      const dto: UpdateSocialDto = { packageFee: 200000 };

      await expect(service.update(socialId, dto, creatorId)).rejects.toThrow(
        new BadRequestException('Cannot update packageFee when social is already published'),
      );
    });

    it('recalculates participant fees when packageFee changes', async () => {
      const social = { id: socialId, creatorId, status: SocialStatus.DRAFT, packageFee: 100000, isFree: false };
      mockPrisma.social.findFirst.mockResolvedValue(social);
      mockPrisma.social.update.mockResolvedValue({ ...social, packageFee: 150000 });
      mockPrisma.socialParticipant.findMany.mockResolvedValue([{ id: 'p-1' }, { id: 'p-2' }]);

      const dto: UpdateSocialDto = { packageFee: 150000 };
      await service.update(socialId, dto, creatorId);

      expect(mockSocialParticipantService.recalculateParticipantTotalFee).toHaveBeenCalledTimes(2);
    });
  });

  describe('duplicate', () => {
    const originalSocialId = 'original-social';
    const creatorId = '11111111-1111-4111-8111-111111111111';
    const mockDto = {
      newSessions: [
        {
          title: 'Session 1',
          bookingIds: ['booking-1'],
          startTime: '2026-06-05T09:00:00.000Z',
          endTime: '2026-06-05T11:00:00.000Z',
        },
      ],
    };

    it('throws NotFoundException when original social is missing', async () => {
      mockPrisma.social.findUnique.mockResolvedValue(null);
      await expect(
        service.duplicate(originalSocialId, creatorId, mockDto),
      ).rejects.toThrow(new NotFoundException('Social not found'));
    });

    it('throws ForbiddenException when user is not the creator of original social', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({
        id: originalSocialId,
        creatorId: 'another-user',
      });
      await expect(
        service.duplicate(originalSocialId, creatorId, mockDto),
      ).rejects.toThrow(new ForbiddenException('Not authorized.'));
    });
  });

  describe('publish', () => {
    const socialId = 'social-123';
    const creatorId = '11111111-1111-4111-8111-111111111111';

    it('successfully publishes paid social when all validation checks pass', async () => {
      const draftSocial = {
        id: socialId,
        creatorId,
        status: SocialStatus.DRAFT,
        packageFee: 100000,
        isFree: false,
        paymentBankName: 'Vietcombank',
        paymentAccountName: 'NGUYEN VAN A',
        paymentAccountNumber: '1234567890',
        paymentQrUrl: 'https://vietqr.example.com/qr.png',
      };

      mockPrisma.social.findFirst.mockResolvedValue(draftSocial);
      mockPrisma.playSession.findMany.mockResolvedValue([{ id: 'session-1', sessionFee: 50000 }]);
      mockPrisma.social.update.mockResolvedValue({ ...draftSocial, status: SocialStatus.PUBLISHED });

      const result = await service.publish(socialId, creatorId);

      expect(mockPrisma.social.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: socialId },
          data: { status: SocialStatus.PUBLISHED },
        }),
      );
      expect(result.data.status).toBe(SocialStatus.PUBLISHED);
    });

    it('throws BadRequestException when paid social is missing paymentBankName', async () => {
      const draftSocial = {
        id: socialId,
        creatorId,
        status: SocialStatus.DRAFT,
        packageFee: 100000,
        isFree: false,
        paymentBankName: null,
      };

      mockPrisma.social.findFirst.mockResolvedValue(draftSocial);

      await expect(service.publish(socialId, creatorId)).rejects.toThrow(
        new BadRequestException('Payment bank name is required before publishing'),
      );
    });
  });

  describe('complete', () => {
    const socialId = 'social-123';
    const creatorId = '11111111-1111-4111-8111-111111111111';

    it('successfully completes a published social and its play sessions', async () => {
      const social = {
        id: socialId,
        creatorId,
        status: SocialStatus.PUBLISHED,
      };

      mockPrisma.social.findUnique.mockResolvedValue(social);
      mockPrisma.social.update.mockResolvedValue({ ...social, status: SocialStatus.COMPLETED });

      const result = await service.complete(socialId, creatorId);

      expect(mockPrisma.social.findUnique).toHaveBeenCalledWith({
        where: { id: socialId },
        select: { id: true, status: true, creatorId: true },
      });

      expect(mockPrisma.playSession.updateMany).toHaveBeenCalledWith({
        where: {
          socialId: socialId,
          status: {
            in: ['ACTIVE', 'IN_PROGRESS'],
          },
        },
        data: { status: 'COMPLETED' },
      });

      expect(mockPrisma.social.update).toHaveBeenCalledWith({
        where: { id: socialId },
        data: { status: SocialStatus.COMPLETED },
      });

      expect(result.message).toBe('Social completed successfully');
      expect(result.data.status).toBe(SocialStatus.COMPLETED);
    });

    it('throws NotFoundException when social does not exist', async () => {
      mockPrisma.social.findUnique.mockResolvedValue(null);

      await expect(service.complete(socialId, creatorId)).rejects.toThrow(
        new NotFoundException('Social not found'),
      );
    });

    it('throws ForbiddenException when caller is not the creator', async () => {
      const social = {
        id: socialId,
        creatorId: 'different-creator-id',
        status: SocialStatus.PUBLISHED,
      };
      mockPrisma.social.findUnique.mockResolvedValue(social);

      await expect(service.complete(socialId, creatorId)).rejects.toThrow(
        new ForbiddenException('Only the creator can complete this social'),
      );
    });

    it('returns immediately if social is already completed', async () => {
      const social = {
        id: socialId,
        creatorId,
        status: SocialStatus.COMPLETED,
      };
      mockPrisma.social.findUnique.mockResolvedValue(social);

      const result = await service.complete(socialId, creatorId);

      expect(result.message).toBe('Social already completed');
      expect(result.data.status).toBe(SocialStatus.COMPLETED);
      expect(mockPrisma.social.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when social is in DRAFT status', async () => {
      const social = {
        id: socialId,
        creatorId,
        status: SocialStatus.DRAFT,
      };
      mockPrisma.social.findUnique.mockResolvedValue(social);

      await expect(service.complete(socialId, creatorId)).rejects.toThrow(
        new BadRequestException('Only published socials can be completed'),
      );
    });

    it('throws BadRequestException when social is in CANCELLED status', async () => {
      const social = {
        id: socialId,
        creatorId,
        status: SocialStatus.CANCELLED,
      };
      mockPrisma.social.findUnique.mockResolvedValue(social);

      await expect(service.complete(socialId, creatorId)).rejects.toThrow(
        new BadRequestException('Only published socials can be completed'),
      );
    });
  });

  describe('getOneById', () => {
    const socialId = 'social-123';
    const creatorId = '11111111-1111-4111-8111-111111111111';

    it('throws NotFoundException when social does not exist', async () => {
      mockPrisma.social.findFirst.mockResolvedValue(null);
      await expect(service.getOneById(socialId)).rejects.toThrow(
        new NotFoundException('Social not found'),
      );
    });

    it('returns social with myParticipantInfo as null and isParticipant as false when userId is not provided', async () => {
      const social = { id: socialId, creatorId, title: 'Test Social' };
      mockPrisma.social.findFirst.mockResolvedValue(social);
      mockUserService.getUserById.mockResolvedValue({ id: creatorId, fullName: 'Creator Host' });

      const result = await service.getOneById(socialId);

      expect(result.data.isParticipant).toBe(false);
      expect(result.data.myParticipantInfo).toBeNull();
      expect(result.data.isHost).toBe(false);
    });

    it('returns social with myParticipantInfo as null and isParticipant as false when user is not a participant', async () => {
      const social = { id: socialId, creatorId, title: 'Test Social' };
      mockPrisma.social.findFirst.mockResolvedValue(social);
      mockUserService.getUserById.mockResolvedValue({ id: creatorId, fullName: 'Creator Host' });
      mockPrisma.socialParticipant.findUnique.mockResolvedValue(null);

      const result = await service.getOneById(socialId, 'some-other-user');

      expect(result.data.isParticipant).toBe(false);
      expect(result.data.myParticipantInfo).toBeNull();
      expect(result.data.isHost).toBe(false);
    });

    it('returns social with myParticipantInfo and isParticipant as true when user is a participant', async () => {
      const social = { id: socialId, creatorId, title: 'Test Social' };
      const mockParticipant = {
        id: 'part-123',
        status: 'CONFIRMED',
        totalFee: 100000,
        amountPaid: 100000,
        amountRefunded: 0,
        isFullPackage: true,
        paymentStatus: 'PAID',
        joinedAt: new Date(),
      };
      mockPrisma.social.findFirst.mockResolvedValue(social);
      mockUserService.getUserById.mockResolvedValue({ id: creatorId, fullName: 'Creator Host' });
      mockPrisma.socialParticipant.findUnique.mockResolvedValue(mockParticipant);
      mockPrisma.playSessionParticipant.findMany.mockResolvedValue([
        { playSessionId: 'session-1' },
      ]);

      const result = await service.getOneById(socialId, creatorId);

      expect(result.data.isParticipant).toBe(true);
      expect(result.data.isHost).toBe(true);
      expect(result.data.myParticipantInfo).toBeDefined();
      expect(result.data.myParticipantInfo?.id).toBe('part-123');
      expect(result.data.myParticipantInfo?.joinedSessionIds).toEqual(['session-1']);
    });
  });

  describe('mySchedule', () => {
    const userId = '11111111-1111-4111-8111-111111111111';

    it('filters correctly for host role', async () => {
      mockPrisma.social.findMany.mockResolvedValue([]);
      mockPrisma.social.count.mockResolvedValue(0);

      const query = { role: 'host' as any, tab: 'upcoming' as any };
      await service.mySchedule(userId, query);

      expect(mockPrisma.social.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            creatorId: userId,
          }),
        }),
      );
    });

    it('filters correctly by search keyword', async () => {
      mockPrisma.social.findMany.mockResolvedValue([]);
      mockPrisma.social.count.mockResolvedValue(0);

      const query = { search: 'friendly' };
      await service.mySchedule(userId, query);

      expect(mockPrisma.social.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: [
                  { title: { contains: 'friendly', mode: 'insensitive' } },
                  { note: { contains: 'friendly', mode: 'insensitive' } },
                ],
              }),
            ]),
          }),
        }),
      );
    });

    it('filters correctly for player role, excluding user created/host socials', async () => {
      mockPrisma.social.findMany.mockResolvedValue([]);
      mockPrisma.social.count.mockResolvedValue(0);

      const query = { role: 'player' as any, tab: 'upcoming' as any };
      await service.mySchedule(userId, query);

      expect(mockPrisma.social.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            creatorId: { not: userId },
            participants: {
              some: {
                userId,
                status: { not: 'CANCELLED' },
              },
            },
          }),
        }),
      );
    });

    it('applies OR default filter when role is not provided', async () => {
      mockPrisma.social.findMany.mockResolvedValue([]);
      mockPrisma.social.count.mockResolvedValue(0);

      const query = { tab: 'upcoming' as any };
      await service.mySchedule(userId, query);

      expect(mockPrisma.social.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { creatorId: userId },
              {
                participants: {
                  some: {
                    userId,
                    status: { not: 'CANCELLED' },
                  },
                },
              },
            ],
          }),
        }),
      );
    });

    it('filters correctly by status if status is provided', async () => {
      mockPrisma.social.findMany.mockResolvedValue([]);
      mockPrisma.social.count.mockResolvedValue(0);

      const query = { tab: 'upcoming' as any, status: 'PUBLISHED' as any };
      await service.mySchedule(userId, query);

      expect(mockPrisma.social.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PUBLISHED',
          }),
        }),
      );
    });
  });

  describe('getSocialStats', () => {
    const socialId = 'social-123';
    const userId = '11111111-1111-4111-8111-111111111111';

    it('throws NotFoundException when social does not exist', async () => {
      mockPrisma.social.findUnique.mockResolvedValue(null);
      await expect(service.getSocialStats(socialId, userId)).rejects.toThrow(
        new NotFoundException('Social not found'),
      );
    });

    it('throws ForbiddenException when user is not the host and not a confirmed participant', async () => {
      const social = { id: socialId, creatorId: 'host-id' };
      mockPrisma.social.findUnique.mockResolvedValue(social);
      mockPrisma.socialParticipant.findUnique.mockResolvedValue(null);

      await expect(service.getSocialStats(socialId, userId)).rejects.toThrow(
        new ForbiddenException('Only confirmed participants or the host can view social statistics'),
      );
    });

    it('successfully retrieves stats for the host', async () => {
      const social = { id: socialId, creatorId: userId, status: SocialStatus.COMPLETED };
      const stats = { id: 'stats-1', socialId, totalMatches: 5 };
      mockPrisma.social.findUnique.mockResolvedValue(social);
      mockPrisma.socialStats.findUnique.mockResolvedValue(stats);

      const result = await service.getSocialStats(socialId, userId);
      expect(result.data).toEqual(stats);
    });

    it('successfully retrieves stats for a confirmed participant', async () => {
      const social = { id: socialId, creatorId: 'host-id', status: SocialStatus.COMPLETED };
      const participant = { id: 'p-1', status: 'CONFIRMED' };
      const stats = { id: 'stats-1', socialId, totalMatches: 5 };
      mockPrisma.social.findUnique.mockResolvedValue(social);
      mockPrisma.socialParticipant.findUnique.mockResolvedValue(participant);
      mockPrisma.socialStats.findUnique.mockResolvedValue(stats);

      const result = await service.getSocialStats(socialId, userId);
      expect(result.data).toEqual(stats);
    });

    it('throws BadRequestException when stats are requested for DRAFT or CANCELLED socials', async () => {
      const social = { id: socialId, creatorId: userId, status: SocialStatus.DRAFT };
      mockPrisma.social.findUnique.mockResolvedValue(social);

      await expect(service.getSocialStats(socialId, userId)).rejects.toThrow(
        new BadRequestException('Statistics are only available for published or completed socials (current status: DRAFT)'),
      );
    });

    it('always compiles stats on-demand for PUBLISHED socials even if cache exists', async () => {
      const social = { id: socialId, creatorId: userId, status: SocialStatus.PUBLISHED };
      const oldStats = { id: 'stats-1', socialId, totalMatches: 5 };
      const newStats = { id: 'stats-1', socialId, totalMatches: 6 };
      mockPrisma.social.findUnique.mockResolvedValue(social);

      mockPrisma.socialStats.findUnique
        .mockResolvedValueOnce(oldStats)
        .mockResolvedValueOnce(newStats);

      const spy = jest.spyOn(service, 'compileSocialStats').mockResolvedValue(undefined);

      const result = await service.getSocialStats(socialId, userId);
      expect(spy).toHaveBeenCalledWith(socialId);
      expect(result.data).toEqual(newStats);

      spy.mockRestore();
    });

    it('returns cached stats directly without compiling for COMPLETED socials if cache exists', async () => {
      const social = { id: socialId, creatorId: userId, status: SocialStatus.COMPLETED };
      const stats = { id: 'stats-1', socialId, totalMatches: 5 };
      mockPrisma.social.findUnique.mockResolvedValue(social);
      mockPrisma.socialStats.findUnique.mockResolvedValue(stats);

      const spy = jest.spyOn(service, 'compileSocialStats').mockResolvedValue(undefined);

      const result = await service.getSocialStats(socialId, userId);
      expect(spy).not.toHaveBeenCalled();
      expect(result.data).toEqual(stats);

      spy.mockRestore();
    });

    it('compiles stats on-demand if stats are missing and social is COMPLETED', async () => {
      const social = { id: socialId, creatorId: userId, status: SocialStatus.COMPLETED };
      const stats = { id: 'stats-1', socialId, totalMatches: 5 };
      mockPrisma.social.findUnique.mockResolvedValue(social);

      // First call to findUnique returns null, second call returns stats
      mockPrisma.socialStats.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(stats);

      const spy = jest.spyOn(service, 'compileSocialStats').mockResolvedValue(undefined);

      const result = await service.getSocialStats(socialId, userId);
      expect(spy).toHaveBeenCalledWith(socialId);
      expect(result.data).toEqual(stats);

      spy.mockRestore();
    });

    it('throws NotFoundException if fallback compile-on-demand fails and stats are missing', async () => {
      const social = { id: socialId, creatorId: userId, status: SocialStatus.COMPLETED };
      mockPrisma.social.findUnique.mockResolvedValue(social);
      mockPrisma.socialStats.findUnique.mockResolvedValue(null);

      const spy = jest.spyOn(service, 'compileSocialStats').mockRejectedValue(new Error('Compilation failed'));

      await expect(service.getSocialStats(socialId, userId)).rejects.toThrow(
        new NotFoundException('Statistics not found for this social'),
      );
      expect(spy).toHaveBeenCalledWith(socialId);

      spy.mockRestore();
    });
  });

  describe('submitFeedback', () => {
    const socialId = 'social-123';
    const userId = '11111111-1111-4111-8111-111111111111';
    const mockDto = { ratingVenue: 5, ratingOverall: 4, ratingOrganization: 4, comment: 'Nice' };

    it('throws NotFoundException when social does not exist', async () => {
      mockPrisma.social.findUnique.mockResolvedValue(null);
      await expect(service.submitFeedback(socialId, userId, mockDto)).rejects.toThrow(
        new NotFoundException('Social not found'),
      );
    });

    it('throws BadRequestException when social is not completed', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, status: 'PUBLISHED' });
      await expect(service.submitFeedback(socialId, userId, mockDto)).rejects.toThrow(
        new BadRequestException('Feedback can only be submitted for completed socials'),
      );
    });

    it('throws ForbiddenException when user is not a confirmed participant', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, status: 'COMPLETED' });
      mockPrisma.socialParticipant.findUnique.mockResolvedValue(null);

      await expect(service.submitFeedback(socialId, userId, mockDto)).rejects.toThrow(
        new ForbiddenException('Only confirmed participants can submit feedback'),
      );
    });

    it('successfully submits/updates feedback for a completed social and confirmed participant', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, status: 'COMPLETED' });
      mockPrisma.socialParticipant.findUnique.mockResolvedValue({ id: 'p-1', status: 'CONFIRMED' });
      mockPrisma.socialFeedback.upsert.mockResolvedValue({ id: 'f-1', socialId, userId, ...mockDto });

      const result = await service.submitFeedback(socialId, userId, mockDto);
      expect(result.data.id).toBe('f-1');
      expect(mockPrisma.socialFeedback.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { socialId_userId: { socialId, userId } },
          create: expect.objectContaining({ ratingVenue: 5 }),
        }),
      );
    });
  });

  describe('getFeedbackAnalytics', () => {
    const socialId = 'social-123';

    it('throws NotFoundException when social does not exist', async () => {
      mockPrisma.social.findUnique.mockResolvedValue(null);
      await expect(service.getFeedbackAnalytics(socialId)).rejects.toThrow(
        new NotFoundException('Social not found'),
      );
    });

    it('successfully computes feedback analytics and averages', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({ id: socialId });
      mockPrisma.socialFeedback.findMany.mockResolvedValue([
        { id: 'f-1', userId: 'user-1', ratingVenue: 5, ratingOverall: 4, ratingOrganization: 4, comment: 'Great' },
        { id: 'f-2', userId: 'user-2', ratingVenue: 3, ratingOverall: 4, ratingOrganization: 4, comment: 'Okay' },
      ]);
      mockUserService.getManyUsersByIds.mockResolvedValue([
        { id: 'user-1', name: 'Alice', avatarUrl: 'alice-url' },
        { id: 'user-2', name: 'Bob', avatarUrl: 'bob-url' },
      ]);

      const result = await service.getFeedbackAnalytics(socialId);
      expect(result.data.averages.ratingVenue).toBe(4.0);
      expect(result.data.averages.ratingOverall).toBe(4.0);
      expect(result.data.averages.ratingOrganization).toBe(4.0);
      expect(result.data.comments).toHaveLength(2);
      expect(result.data.comments[0].userName).toBe('Alice');
    });

    it('returns null averages when there are no feedbacks', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({ id: socialId });
      mockPrisma.socialFeedback.findMany.mockResolvedValue([]);

      const result = await service.getFeedbackAnalytics(socialId);
      expect(result.data.averages.ratingVenue).toBeNull();
      expect(result.data.averages.totalReviews).toBe(0);
      expect(result.data.comments).toHaveLength(0);
    });
  });

  describe('remove', () => {
    const socialId = 'social-123';
    const creatorId = '11111111-1111-4111-8111-111111111111';
    const userName = 'John Doe';
    let mockCenterAxios: any;

    beforeEach(() => {
      mockCenterAxios = {
        post: jest.fn().mockResolvedValue({ data: {} }),
      };
      (service as any).centerAxios = mockCenterAxios;
      (service as any).notificationService = {
        sendInAppNotification: jest.fn().mockResolvedValue({}),
      };
    });

    it('throws NotFoundException when social does not exist', async () => {
      mockPrisma.social.findUnique.mockResolvedValue(null);

      await expect(service.remove(socialId, creatorId, userName)).rejects.toThrow(
        new NotFoundException('Social not found'),
      );
    });

    it('throws ForbiddenException when requester is not the creator', async () => {
      const social = { id: socialId, creatorId: 'different-creator', status: SocialStatus.DRAFT };
      mockPrisma.social.findUnique.mockResolvedValue(social);

      await expect(service.remove(socialId, creatorId, userName)).rejects.toThrow(
        new ForbiddenException('Only the creator can delete this social'),
      );
    });

    it('throws BadRequestException when social is already cancelled', async () => {
      const social = { id: socialId, creatorId, status: SocialStatus.CANCELLED };
      mockPrisma.social.findUnique.mockResolvedValue(social);

      await expect(service.remove(socialId, creatorId, userName)).rejects.toThrow(
        new BadRequestException('This social is already cancelled'),
      );
    });

    it('successfully deletes a DRAFT social and unlinks all bookings', async () => {
      const social = { id: socialId, creatorId, status: SocialStatus.DRAFT };
      mockPrisma.social.findUnique.mockResolvedValue(social);
      mockPrisma.playSession.findMany.mockResolvedValue([
        { id: 'session-1', bookingIds: ['booking-1', 'booking-2'] },
        { id: 'session-2', bookingIds: [] },
      ]);

      const result = await service.remove(socialId, creatorId, userName);

      expect(mockCenterAxios.post).toHaveBeenCalledWith('/api/bookings/unlink-play-session', {
        bookingIds: ['booking-1', 'booking-2'],
        playSessionId: 'session-1',
      });
      expect(mockCenterAxios.post).toHaveBeenCalledTimes(1);
      expect(mockPrisma.social.delete).toHaveBeenCalledWith({
        where: { id: socialId },
      });
      expect(result.message).toBe('Social deleted successfully');
    });

    it('successfully cancels a PUBLISHED social, unlinks bookings, and cancels play sessions', async () => {
      const social = { id: socialId, creatorId, status: SocialStatus.PUBLISHED, title: 'Epic Social' };
      mockPrisma.social.findUnique.mockResolvedValue(social);
      mockPrisma.playSession.findMany.mockResolvedValue([
        { id: 'session-1', bookingIds: ['booking-1'] },
      ]);
      mockPrisma.socialParticipant.findMany.mockResolvedValue([{ userId: 'user-1' }]);

      const result = await service.remove(socialId, creatorId, userName);

      expect(mockCenterAxios.post).toHaveBeenCalledWith('/api/bookings/unlink-play-session', {
        bookingIds: ['booking-1'],
        playSessionId: 'session-1',
      });
      expect(mockPrisma.playSession.updateMany).toHaveBeenCalledWith({
        where: { socialId },
        data: { status: 'CANCELLED' },
      });
      expect(mockPrisma.social.update).toHaveBeenCalledWith({
        where: { id: socialId },
        data: { status: 'CANCELLED' },
      });
      expect((service as any).notificationService.sendInAppNotification).toHaveBeenCalledWith(
        ['user-1'],
        'Social Cancelled',
        `The social "Epic Social" has been cancelled by the John Doe`,
      );
      expect(result.message).toBe('Social deleted successfully');
    });

    it('successfully cancels a PUBLISHED social even if sending notifications throws an error', async () => {
      const social = { id: socialId, creatorId, status: SocialStatus.PUBLISHED, title: 'Epic Social' };
      mockPrisma.social.findUnique.mockResolvedValue(social);
      mockPrisma.playSession.findMany.mockResolvedValue([
        { id: 'session-1', bookingIds: ['booking-1'] },
      ]);
      mockPrisma.socialParticipant.findMany.mockResolvedValue([{ userId: 'user-1' }]);

      (service as any).notificationService.sendInAppNotification.mockRejectedValue(new Error('Notification service down'));

      const result = await service.remove(socialId, creatorId, userName);

      expect(mockPrisma.social.update).toHaveBeenCalledWith({
        where: { id: socialId },
        data: { status: 'CANCELLED' },
      });
      expect(result.message).toBe('Social deleted successfully');
    });
  });

  describe('discover socials', () => {
    const userId = '11111111-1111-4111-8111-111111111111';

    it('should run standard discover pagination and return socials', async () => {
      const query = { page: 1, limit: 10 };

      const mockSocials = [
        {
          id: 'social-1',
          creatorId: 'creator-1',
          status: 'PUBLISHED',
          playSessions: [],
          participants: [],
        },
      ];

      mockPrisma.social.findMany.mockResolvedValue(mockSocials);
      mockPrisma.social.count.mockResolvedValue(1);
      mockUserService.getManyUsersByIds.mockResolvedValue([]);

      const result = await service.discover(query, userId);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('social-1');
      expect(mockPrisma.social.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });
});