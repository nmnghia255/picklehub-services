import { Test, TestingModule } from '@nestjs/testing';
import { SocialParticipantService } from '../participant/social-participant.service';
import { SessionService } from '../play-session/session.service';
import { PlaySessionLifecycleService } from '../play-session/lifecycle/play-session-lifecycle.service';
import { ExpenseService } from '../finance/expense/expense.service';
import { PrismaService } from '../../prisma.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationService } from '../../notification/notification.service';
import { UserService } from '../../user/user.service';
import { SocialService } from '../social.service';
import { BadRequestException } from '@nestjs/common';
import { SocialStatus, PlaySessionStatus, SocialParticipantStatus, SocialPaymentStatus } from '@prisma/client';

describe('Social Protection Flows (COMPLETED and CANCELLED)', () => {
  let participantService: SocialParticipantService;
  let sessionService: SessionService;
  let lifecycleService: PlaySessionLifecycleService;
  let expenseService: ExpenseService;

  const mockPrisma: any = {
    social: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    socialParticipant: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    playSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    socialPayment: {
      findFirst: jest.fn(),
    },
    socialExpense: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
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

  const mockNotificationService = {
    sendInAppNotification: jest.fn().mockResolvedValue({}),
  };

  const mockUserService = {
    getUserById: jest.fn(),
    getManyUsersByIds: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockSocialService = {
    compileSocialStats: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialParticipantService,
        SessionService,
        PlaySessionLifecycleService,
        ExpenseService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: UserService, useValue: mockUserService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: SocialService, useValue: mockSocialService },
      ],
    }).compile();

    participantService = module.get<SocialParticipantService>(SocialParticipantService);
    sessionService = module.get<SessionService>(SessionService);
    lifecycleService = module.get<PlaySessionLifecycleService>(PlaySessionLifecycleService);
    expenseService = module.get<ExpenseService>(ExpenseService);
  });

  const creatorId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const socialId = 'social-123';
  const participantId = 'part-123';
  const sessionId = 'session-123';
  const expenseId = 'expense-123';

  describe('SocialParticipantService', () => {
    it.each([SocialStatus.COMPLETED, SocialStatus.CANCELLED])(
      'throws BadRequestException on requireCreator operations if social is %s',
      async (status) => {
        mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, creatorId, status });

        // Test approve
        mockPrisma.socialParticipant.findFirst.mockResolvedValue({ id: participantId, socialId, status: SocialParticipantStatus.WAITLISTED });
        await expect(participantService.approve(socialId, participantId, creatorId)).rejects.toThrow(
          new BadRequestException('Cannot modify details of a completed or cancelled social'),
        );

        // Test updateStatus
        await expect(participantService.updateStatus(socialId, participantId, creatorId, { status: SocialParticipantStatus.CONFIRMED })).rejects.toThrow(
          new BadRequestException('Cannot modify details of a completed or cancelled social'),
        );

        // Test kick
        await expect(participantService.kick(socialId, participantId, creatorId, 'Host')).rejects.toThrow(
          new BadRequestException('Cannot modify details of a completed or cancelled social'),
        );

        // Test verify
        mockPrisma.socialPayment.findFirst.mockResolvedValue({ id: 'pay-1', status: SocialPaymentStatus.PENDING_REVIEW, amount: 10000 });
        await expect(participantService.verify(socialId, participantId, creatorId, { paymentId: 'pay-1', status: SocialPaymentStatus.CONFIRMED })).rejects.toThrow(
          new BadRequestException('Cannot modify details of a completed or cancelled social'),
        );

        // Test refund
        mockPrisma.socialParticipant.findFirst.mockResolvedValue({ id: participantId, socialId, amountPaid: 20000, amountRefunded: 0, totalFee: 10000 });
        await expect(participantService.refund(socialId, participantId, creatorId, { amount: 5000 })).rejects.toThrow(
          new BadRequestException('Cannot modify details of a completed or cancelled social'),
        );

        // Test recordDirectPayment
        mockPrisma.socialParticipant.findFirst.mockResolvedValue({ id: participantId, socialId, status: SocialParticipantStatus.CONFIRMED });
        await expect(participantService.recordDirectPayment(socialId, participantId, creatorId, { amount: 10000 })).rejects.toThrow(
          new BadRequestException('Cannot modify details of a completed or cancelled social'),
        );
      },
    );

    it.each([SocialStatus.COMPLETED, SocialStatus.CANCELLED])(
      'throws BadRequestException on pay if social is %s',
      async (status) => {
        mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, status });

        await expect(participantService.pay(socialId, userId, { amount: 10000 })).rejects.toThrow(
          new BadRequestException('Cannot submit payment for a completed or cancelled social'),
        );
      },
    );

    it.each([SocialStatus.COMPLETED, SocialStatus.CANCELLED])(
      'throws BadRequestException on leaveAsMe if social is %s',
      async (status) => {
        mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, status });

        await expect(participantService.leaveAsMe(socialId, userId)).rejects.toThrow(
          new BadRequestException('Cannot leave a completed or cancelled social'),
        );
      },
    );
  });

  describe('SessionService', () => {
    it.each([SocialStatus.COMPLETED, SocialStatus.CANCELLED])(
      'throws BadRequestException on create play session if social is %s',
      async (status) => {
        mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, creatorId, status });

        await expect(sessionService.create({ title: 'New Session', bookingIds: ['b-1'] }, creatorId, socialId)).rejects.toThrow(
          new BadRequestException('Cannot create play session in a cancelled or completed social'),
        );
      },
    );

    it.each([SocialStatus.COMPLETED, SocialStatus.CANCELLED])(
      'throws BadRequestException on update play session if social is %s',
      async (status) => {
        mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, creatorId, status });

        await expect(sessionService.update(socialId, sessionId, { title: 'Updated Session' }, creatorId)).rejects.toThrow(
          new BadRequestException('Cannot update play session in a cancelled or completed social'),
        );
      },
    );

    it.each([SocialStatus.COMPLETED, SocialStatus.CANCELLED])(
      'throws BadRequestException on remove play session if social is %s',
      async (status) => {
        mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, creatorId, status });

        await expect(sessionService.remove(socialId, sessionId, creatorId)).rejects.toThrow(
          new BadRequestException('Cannot delete play session in a cancelled or completed social'),
        );
      },
    );

    it.each([SocialStatus.COMPLETED, SocialStatus.CANCELLED])(
      'throws BadRequestException on cancel play session if social is %s',
      async (status) => {
        mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, creatorId, status });

        await expect(sessionService.cancel(socialId, sessionId, creatorId)).rejects.toThrow(
          new BadRequestException('Cannot cancel play session in a cancelled or completed social'),
        );
      },
    );
  });

  describe('PlaySessionLifecycleService', () => {
    it.each([SocialStatus.COMPLETED, SocialStatus.CANCELLED])(
      'throws BadRequestException on start play session if social is %s',
      async (status) => {
        mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, creatorId, status });

        await expect(lifecycleService.start(socialId, sessionId, creatorId)).rejects.toThrow(
          new BadRequestException('Cannot perform action on a completed or cancelled social'),
        );
      },
    );

    it.each([SocialStatus.COMPLETED, SocialStatus.CANCELLED])(
      'throws BadRequestException on complete play session if social is %s',
      async (status) => {
        mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, creatorId, status });

        await expect(lifecycleService.complete(socialId, sessionId, creatorId)).rejects.toThrow(
          new BadRequestException('Cannot perform action on a completed or cancelled social'),
        );
      },
    );
  });

  describe('ExpenseService', () => {
    it.each([SocialStatus.COMPLETED, SocialStatus.CANCELLED])(
      'throws BadRequestException on expense mutations if social is %s',
      async (status) => {
        mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, creatorId, status });
        mockPrisma.socialParticipant.findUnique.mockResolvedValue({ id: participantId, isHost: true });

        // Test createExpense
        await expect(expenseService.createExpense(socialId, creatorId, { title: 'Ball', amount: '100' })).rejects.toThrow(
          new BadRequestException('Cannot modify expenses of a completed or cancelled social'),
        );

        // Test updateExpense
        mockPrisma.socialExpense.findFirst.mockResolvedValue({ id: expenseId, socialId, title: 'Ball', amount: 100, createdById: creatorId });
        await expect(expenseService.updateExpense(expenseId, socialId, creatorId, { title: 'New Ball' })).rejects.toThrow(
          new BadRequestException('Cannot modify expenses of a completed or cancelled social'),
        );

        // Test deleteExpense
        await expect(expenseService.deleteExpense(expenseId, socialId, creatorId)).rejects.toThrow(
          new BadRequestException('Cannot modify expenses of a completed or cancelled social'),
        );
      },
    );

    it('successfully creates and updates an expense even if notification sending throws an error', async () => {
      mockPrisma.social.findUnique.mockResolvedValue({ id: socialId, creatorId, status: SocialStatus.PUBLISHED, totalBookingCost: 1000 });
      mockPrisma.socialParticipant.findUnique.mockResolvedValue({ id: participantId, isHost: true });
      mockPrisma.socialParticipant.findMany.mockResolvedValue([{ userId: 'user-1' }]);
      mockPrisma.socialExpense.create.mockResolvedValue({ id: expenseId, socialId, title: 'Ball', amount: 100 });
      mockPrisma.socialExpense.aggregate.mockResolvedValue({ _sum: { amount: 100 } });
      mockPrisma.socialExpense.findFirst.mockResolvedValue({ id: expenseId, socialId, title: 'Ball', amount: 100 });
      mockPrisma.socialExpense.update.mockResolvedValue({ id: expenseId, socialId, title: 'New Ball', amount: 120 });

      mockNotificationService.sendInAppNotification.mockRejectedValue(new Error('Notification error'));

      const createResult = await expenseService.createExpense(socialId, creatorId, { title: 'Ball', amount: '100' });
      expect(createResult.message).toBe('Expense created successfully');

      const updateResult = await expenseService.updateExpense(expenseId, socialId, creatorId, { title: 'New Ball', amount: '120' });
      expect(updateResult.message).toBe('Expense updated successfully');
    });
  });
});
