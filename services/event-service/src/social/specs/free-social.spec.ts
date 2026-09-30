import { Test, TestingModule } from '@nestjs/testing';
import { SocialService } from '../social.service';
import { SessionService } from '../play-session/session.service';
import { PrismaService } from '../../prisma.service';
import { ConfigService } from '@nestjs/config';
import { SocialParticipantService } from '../participant/social-participant.service';
import { NotificationService } from '../../notification/notification.service';
import { UserService } from '../../user/user.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SocialStatus, PlaySessionStatus, SocialHostRole } from '@prisma/client';
import { CreateSocialDto } from '../dto/create-social.dto';
import { UpdateSocialDto } from '../dto/update-social.dto';

describe('Free Social Features', () => {
  let socialService: SocialService;
  let sessionService: SessionService;

  const mockPrisma: any = {
    social: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    playSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({
        _min: { startTime: null },
        _max: { endTime: null },
      }),
    },
    socialExpense: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { amount: 0 },
      }),
    },
    socialParticipant: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
    },
    playSessionParticipant: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  const mockConfigService = {
    get: jest.fn((key) => {
      if (key === 'SPORT_CENTER_SERVICE_URL') return 'http://localhost';
      if (key === 'SERVICE_INTERNAL_TOKEN') return 'token';
      return null;
    }),
  };

  const mockSocialParticipantService = {
    recalculateParticipantTotalFee: jest.fn(),
  };

  const mockNotificationService = {};
  const mockUserService = {};

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialService,
        SessionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SocialParticipantService, useValue: mockSocialParticipantService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    socialService = module.get<SocialService>(SocialService);
    sessionService = module.get<SessionService>(SessionService);
  });

  describe('SocialService.create', () => {
    it('forces packageFee to 0 when isFree is true', async () => {
      const dto: CreateSocialDto = {
        title: 'Free Event',
        isFree: true,
        packageFee: 150000,
      };

      mockPrisma.social.create.mockResolvedValue({
        id: 'social-1',
        ...dto,
        packageFee: 0,
      });
      mockPrisma.socialParticipant.create.mockResolvedValue({});

      const result = await socialService.create(dto, '11111111-1111-4111-8111-111111111111');

      expect(mockPrisma.social.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isFree: true,
            packageFee: 0,
          }),
        }),
      );
      expect(result.data.packageFee).toBe(0);
    });
  });

  describe('SocialService.update', () => {
    it('forces packageFee to 0 and updates sessions to 0 when isFreeTarget is true', async () => {
      const existingSocial = {
        id: 'social-1',
        creatorId: '11111111-1111-4111-8111-111111111111',
        joinedCount: 1,
        status: SocialStatus.PUBLISHED, // Draft/Published doesn't matter for this validation unless packageFee updates
        packageFee: 100000,
        isFree: false,
      };

      mockPrisma.social.findFirst.mockResolvedValue(existingSocial);
      mockPrisma.social.update.mockResolvedValue({
        ...existingSocial,
        isFree: true,
        packageFee: 0,
      });
      mockPrisma.socialParticipant.findMany.mockResolvedValue([]);

      const dto: UpdateSocialDto = {
        isFree: true,
      };

      const result = await socialService.update(
        'social-1',
        dto,
        '11111111-1111-4111-8111-111111111111',
      );

      expect(mockPrisma.playSession.updateMany).toHaveBeenCalledWith({
        where: { socialId: 'social-1' },
        data: { sessionFee: 0 },
      });
      expect(mockPrisma.social.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'social-1' },
          data: expect.objectContaining({
            isFree: true,
            packageFee: 0,
          }),
        }),
      );
    });
  });

  describe('SocialService.publish', () => {
    it('skips QR and bank checks when social is free', async () => {
      const freeSocial = {
        id: 'social-1',
        status: SocialStatus.DRAFT,
        creatorId: '11111111-1111-4111-8111-111111111111',
        packageFee: 0,
        isFree: true,
        paymentBankName: null,
        paymentAccountName: null,
        paymentAccountNumber: null,
        paymentQrUrl: null,
      };

      mockPrisma.social.findFirst.mockResolvedValue(freeSocial);
      mockPrisma.playSession.findMany.mockResolvedValue([
        { id: 'session-1', sessionFee: 0 },
      ]);
      mockPrisma.social.update.mockResolvedValue({
        ...freeSocial,
        status: SocialStatus.PUBLISHED,
      });

      const result = await socialService.publish('social-1', '11111111-1111-4111-8111-111111111111');
      expect(result.data.status).toBe(SocialStatus.PUBLISHED);
    });

    it('throws when paid social lacks payment details', async () => {
      const paidSocial = {
        id: 'social-1',
        status: SocialStatus.DRAFT,
        creatorId: '11111111-1111-4111-8111-111111111111',
        packageFee: 100000,
        isFree: false,
        paymentBankName: null,
      };

      mockPrisma.social.findFirst.mockResolvedValue(paidSocial);

      await expect(
        socialService.publish('social-1', '11111111-1111-4111-8111-111111111111'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('SessionService', () => {
    it('forces sessionFee to 0 on session create if social is free', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({
        creatorId: '11111111-1111-4111-8111-111111111111',
        isFree: true,
      });

      (sessionService as any).centerAxios = {
        post: jest.fn().mockResolvedValue({
          data: {
            bookingInfos: [
              {
                center: { id: 'center-1', name: 'Center Name' },
                bookingItems: [],
              },
            ],
          },
        }),
      };

      jest.spyOn(sessionService as any, 'buildCourtSummary').mockReturnValue({
        numberOfCourts: 1,
        courtNames: 'Court 1',
        courtSchedule: [],
        sessionStartTime: new Date(Date.now() + 3600000),
        sessionEndTime: new Date(Date.now() + 7200000),
      });

      mockPrisma.playSession.create.mockResolvedValue({
        id: 'session-1',
        sessionFee: 0,
      });

      const result = await sessionService.create(
        {
          title: 'Free Session',
          bookingIds: ['booking-1'],
          sessionFee: 0,
        },
        '11111111-1111-4111-8111-111111111111',
        'social-1',
      );

      expect(result.data.sessionFee).toBe(0);
    });

    it('throws BadRequestException if user sets non-zero sessionFee on free social during session create', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({
        creatorId: '11111111-1111-4111-8111-111111111111',
        isFree: true,
      });

      (sessionService as any).centerAxios = {
        post: jest.fn().mockResolvedValue({
          data: {
            bookingInfos: [
              {
                center: { id: 'center-1', name: 'Center Name' },
                bookingItems: [],
              },
            ],
          },
        }),
      };

      await expect(
        sessionService.create(
          {
            title: 'Paid Session',
            bookingIds: ['booking-1'],
            sessionFee: 50000,
          },
          '11111111-1111-4111-8111-111111111111',
          'social-1',
        ),
      ).rejects.toThrow(new BadRequestException('Cannot set non-zero fee for a session in a free social event'));
    });
  });
});
