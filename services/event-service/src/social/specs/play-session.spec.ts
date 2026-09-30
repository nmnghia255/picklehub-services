import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from '../play-session/session.service';
import { PlaySessionLifecycleService } from '../play-session/lifecycle/play-session-lifecycle.service';
import { PrismaService } from '../../prisma.service';
import { ConfigService } from '@nestjs/config';
import { SocialParticipantService } from '../participant/social-participant.service';
import { PlaySessionParticipantService } from '../play-session/participant/play-session-participant.service';
import { UserService } from '../../user/user.service';
import { SocialService } from '../social.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SocialStatus, PlaySessionStatus, SocialParticipantStatus, PlaySessionParticipantStatus } from '@prisma/client';

describe('Play Session and Lifecycle Core Flows', () => {
  let sessionService: SessionService;
  let lifecycleService: PlaySessionLifecycleService;
  let participantService: PlaySessionParticipantService;

  const mockPrisma: any = {
    social: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    playSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn().mockResolvedValue({
        _min: { startTime: null },
        _max: { endTime: null },
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    socialParticipant: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    playSessionParticipant: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    socialExpense: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: { amount: 0 },
      }),
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
    cancelParticipantTx: jest.fn(),
    refreshHasAvailableSlots: jest.fn(),
  };

  const mockUserService = {
    getUserById: jest.fn(),
    getManyUsersByIds: jest.fn(),
  };

  const mockSocialService = {
    compileSocialStats: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        PlaySessionLifecycleService,
        PlaySessionParticipantService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SocialParticipantService, useValue: mockSocialParticipantService },
        { provide: UserService, useValue: mockUserService },
        { provide: SocialService, useValue: mockSocialService },
      ],
    }).compile();

    sessionService = module.get<SessionService>(SessionService);
    lifecycleService = module.get<PlaySessionLifecycleService>(PlaySessionLifecycleService);
    participantService = module.get<PlaySessionParticipantService>(PlaySessionParticipantService);
  });

  describe('SessionService.create', () => {
    const creatorId = '11111111-1111-4111-8111-111111111111';
    const socialId = 'social-123';

    it('throws BadRequestException when social is not found', async () => {
      mockPrisma.social.findUnique.mockResolvedValue(null);

      await expect(
        sessionService.create(
          { title: 'Session A', bookingIds: ['booking-1'] },
          creatorId,
          socialId,
        ),
      ).rejects.toThrow(new BadRequestException('Social not found'));
    });

    it('throws ForbiddenException when creatorId does not match the userId', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({ creatorId: 'another-creator' });

      await expect(
        sessionService.create(
          { title: 'Session A', bookingIds: ['booking-1'] },
          creatorId,
          socialId,
        ),
      ).rejects.toThrow(new ForbiddenException('Only the creator can create play sessions'));
    });

    it('successfully creates session and links bookings', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({ creatorId, isFree: false });
      mockPrisma.playSession.findFirst.mockResolvedValue(null); // No title conflict

      // Mock Sport Center Service batch bookings response
      (sessionService as any).centerAxios = {
        post: jest.fn().mockResolvedValue({
          data: {
            bookingInfos: [
              {
                center: { id: 'center-1', name: 'Hoang Vy Center', address: 'Dist 7' },
                bookingItems: [
                  {
                    startTime: '07:00',
                    endTime: '09:00',
                    court: { id: 'court-1', name: 'Court A' },
                  }
                ],
                date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                totalPrice: 150000,
              }
            ],
          },
        }),
      };

      mockPrisma.playSession.create.mockResolvedValue({
        id: 'session-1',
        title: 'Session A',
        sessionFee: 50000,
        maxSlots: 20,
      });
      mockPrisma.socialParticipant.findFirst.mockResolvedValue({
        userId: creatorId,
      });

      const result = await sessionService.create(
        { title: 'Session A', bookingIds: ['booking-1'], sessionFee: 50000, maxSlots: 20 },
        creatorId,
        socialId,
      );

      expect((sessionService as any).centerAxios.post).toHaveBeenCalledWith(
        '/api/bookings/link-play-session',
        expect.objectContaining({
          bookingIds: ['booking-1'],
          playSessionId: 'session-1',
        }),
      );
      expect(result.data.title).toBe('Session A');
      expect(result.data.maxSlots).toBe(20);
      expect(result.data.isParticipant).toBe(true);
    });
  });

  describe('PlaySessionLifecycleService.start', () => {
    const creatorId = '11111111-1111-4111-8111-111111111111';
    const socialId = 'social-123';
    const sessionId = 'session-1';

    it('transitions play session to IN_PROGRESS and seeds participants', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({ creatorId });
      mockPrisma.playSession.findFirst.mockResolvedValue({
        id: sessionId,
        status: PlaySessionStatus.ACTIVE,
      });

      // Mock confirmed SocialParticipants
      mockPrisma.socialParticipant.findMany.mockResolvedValue([
        { userId: 'u-1', status: SocialParticipantStatus.CONFIRMED },
        { userId: 'u-2', status: SocialParticipantStatus.CONFIRMED },
      ]);

      mockPrisma.playSessionParticipant.createMany.mockResolvedValue({ count: 2 });

      mockPrisma.playSession.update.mockResolvedValue({
        id: sessionId,
        status: PlaySessionStatus.IN_PROGRESS,
      });

      const result = await lifecycleService.start(socialId, sessionId, creatorId);

      expect(mockPrisma.playSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { status: PlaySessionStatus.IN_PROGRESS },
      });
      expect(mockPrisma.playSessionParticipant.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'u-1', status: PlaySessionParticipantStatus.CONFIRMED }),
          expect.objectContaining({ userId: 'u-2', status: PlaySessionParticipantStatus.CONFIRMED }),
        ]),
        skipDuplicates: true,
      });
      expect(result.message).toBe('Play session started');
    });
  });

  describe('PlaySessionLifecycleService.complete', () => {
    const creatorId = '11111111-1111-4111-8111-111111111111';
    const socialId = 'social-123';
    const sessionId = 'session-1';

    it('transitions play session to COMPLETED and cascades to Social if all session are done', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({ creatorId, status: SocialStatus.PUBLISHED });
      mockPrisma.playSession.findFirst.mockResolvedValue({
        id: sessionId,
        status: PlaySessionStatus.IN_PROGRESS,
      });

      mockPrisma.playSession.update.mockResolvedValue({
        id: sessionId,
        status: PlaySessionStatus.COMPLETED,
      });

      // Mock that there are no active/in-progress play sessions remaining
      mockPrisma.playSession.count.mockResolvedValue(0);

      const result = await lifecycleService.complete(socialId, sessionId, creatorId);

      expect(mockPrisma.playSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { status: PlaySessionStatus.COMPLETED },
      });
      expect(mockPrisma.social.update).toHaveBeenCalledWith({
        where: { id: socialId },
        data: { status: SocialStatus.COMPLETED },
      });
      expect(mockSocialService.compileSocialStats).toHaveBeenCalledWith(socialId);
      expect(result.message).toBe('Play session completed');
    });

    it('transitions play session to COMPLETED but does NOT cascade to Social if sibling sessions are still running', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({ creatorId, status: SocialStatus.PUBLISHED });
      mockPrisma.playSession.findFirst.mockResolvedValue({
        id: sessionId,
        status: PlaySessionStatus.IN_PROGRESS,
      });

      mockPrisma.playSession.update.mockResolvedValue({
        id: sessionId,
        status: PlaySessionStatus.COMPLETED,
      });

      // Mock that there are still active/in-progress play sessions remaining
      mockPrisma.playSession.count.mockResolvedValue(1);

      const result = await lifecycleService.complete(socialId, sessionId, creatorId);

      expect(mockPrisma.playSession.update).toHaveBeenCalledWith({
        where: { id: sessionId },
        data: { status: PlaySessionStatus.COMPLETED },
      });
      expect(mockPrisma.social.update).not.toHaveBeenCalled();
      expect(mockSocialService.compileSocialStats).not.toHaveBeenCalled();
      expect(result.message).toBe('Play session completed');
    });
  });

  describe('SessionService.listBySocial & getDetail creator integration', () => {
    const socialId = 'social-123';
    const creatorId = 'c-123';
    const sessionId = 'session-123';

    it('listBySocial returns sessions with resolved creator info, maxSlots, and isParticipant', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, creatorId });
      mockPrisma.playSession.findMany.mockResolvedValue([
        { id: sessionId, socialId, creatorId, title: 'Session A', maxSlots: 15 }
      ]);
      mockPrisma.playSessionParticipant.findMany.mockResolvedValue([
        { playSessionId: sessionId, userId: 'user-123' }
      ]);
      mockUserService.getManyUsersByIds.mockResolvedValue([
        { id: creatorId, name: 'John Doe', email: 'john@example.com', avatarUrl: null }
      ]);

      const result = await sessionService.listBySocial(socialId, 'user-123');

      expect(mockUserService.getManyUsersByIds).toHaveBeenCalledWith([creatorId]);
      expect(result.data[0].creator).toEqual({
        id: creatorId,
        name: 'John Doe',
        email: 'john@example.com',
        avatarUrl: null
      });
      expect(result.data[0].maxSlots).toBe(15);
      expect(result.data[0].isParticipant).toBe(true);
    });

    it('getDetail returns session with resolved creator info, maxSlots, and isParticipant', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, creatorId });
      mockPrisma.playSession.findFirst.mockResolvedValue(
        { id: sessionId, socialId, creatorId, title: 'Session A', maxSlots: 15 }
      );
      mockPrisma.playSessionParticipant.findFirst.mockResolvedValue(
        { playSessionId: sessionId, userId: 'user-123' }
      );
      mockUserService.getUserById.mockResolvedValue(
        { id: creatorId, name: 'John Doe', email: 'john@example.com', avatarUrl: null }
      );

      const result = await sessionService.getDetail(socialId, sessionId, 'user-123');

      expect(mockUserService.getUserById).toHaveBeenCalledWith(creatorId);
      expect(result.data.creator).toEqual({
        id: creatorId,
        name: 'John Doe',
        email: 'john@example.com',
        avatarUrl: null
      });
      expect(result.data.maxSlots).toBe(15);
      expect(result.data.isParticipant).toBe(true);
    });
  });

  describe('PlaySessionParticipantService.list user integration', () => {
    const socialId = 'social-123';
    const sessionId = 'session-123';
    const pUserId = 'user-123';

    it('list returns play session participants with resolved user info', async () => {
      mockPrisma.playSession.findFirst.mockResolvedValue({ id: sessionId, status: PlaySessionStatus.ACTIVE });
      mockPrisma.playSessionParticipant.findMany.mockResolvedValue([
        { id: 'psp-1', playSessionId: sessionId, userId: pUserId, status: PlaySessionParticipantStatus.CONFIRMED }
      ]);
      // mock loadHostUserId
      mockPrisma.socialParticipant.findFirst.mockResolvedValue({ userId: 'host-123' });
      mockUserService.getManyUsersByIds.mockResolvedValue([
        { id: pUserId, name: 'Alice Smith', email: 'alice@example.com', avatarUrl: null }
      ]);

      const result = await participantService.list(socialId, sessionId, { status: null } as any);

      expect(mockUserService.getManyUsersByIds).toHaveBeenCalledWith([pUserId]);
      expect(result.data[0].user).toEqual({
        id: pUserId,
        name: 'Alice Smith',
        email: 'alice@example.com',
        avatarUrl: null
      });
    });
  });

  describe('PlaySessionParticipantService.joinAsMe & leaveAsMe flows', () => {
    const socialId = 'social-123';
    const sessionId = 'session-123';
    const userId = 'user-123';

    it('joinAsMe puts user as ON_HOLD if autoApproveJoinRequests is false', async () => {
      mockPrisma.playSession.findFirst.mockResolvedValue({ id: sessionId, status: PlaySessionStatus.ACTIVE });
      mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, autoApproveJoinRequests: false });
      mockPrisma.playSessionParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.socialParticipant.findUnique.mockResolvedValue(null);
      mockPrisma.socialParticipant.create.mockResolvedValue({ id: 'sp-123', status: SocialParticipantStatus.ON_HOLD, isFullPackage: true });
      mockPrisma.playSessionParticipant.create.mockResolvedValue({
        id: 'psp-123',
        playSessionId: sessionId,
        userId,
        status: PlaySessionParticipantStatus.ON_HOLD,
      });

      const result = await participantService.joinAsMe(socialId, sessionId, userId);

      expect(mockPrisma.socialParticipant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SocialParticipantStatus.ON_HOLD,
          }),
        }),
      );
      expect(mockPrisma.playSessionParticipant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PlaySessionParticipantStatus.ON_HOLD,
          }),
        }),
      );
      expect(result.data.status).toBe(PlaySessionParticipantStatus.ON_HOLD);
    });

    it('leaveAsMe triggers cancelParticipantTx on parent social if it was the last active play session', async () => {
      mockPrisma.playSession.findFirst.mockResolvedValue({ id: sessionId, status: PlaySessionStatus.ACTIVE });
      mockPrisma.playSessionParticipant.findUnique.mockResolvedValue({
        id: 'psp-123',
        playSessionId: sessionId,
        userId,
        status: PlaySessionParticipantStatus.CONFIRMED,
      });
      mockPrisma.playSessionParticipant.update.mockResolvedValue({
        id: 'psp-123',
        playSessionId: sessionId,
        userId,
        status: PlaySessionParticipantStatus.CANCELLED,
      });
      mockPrisma.playSessionParticipant.count.mockResolvedValue(0); // 0 active sessions left
      mockPrisma.socialParticipant.findUnique.mockResolvedValue({
        id: 'sp-123',
        status: SocialParticipantStatus.CONFIRMED,
        isHost: false,
      });

      await participantService.leaveAsMe(socialId, sessionId, userId);

      expect(mockSocialParticipantService.cancelParticipantTx).toHaveBeenCalledWith(
        expect.any(Object),
        socialId,
        userId,
      );
    });
  });
});
