import { Test, TestingModule } from '@nestjs/testing';
import { FinanceService } from './finance.service';
import { PrismaService } from '../prisma.service';
import { UserService } from '../user/user.service';
import { NotificationService } from '../notification/notification.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { GroupMemberRole, PaymentStatus, TransactionStatus } from '@prisma/client';

describe('FinanceService', () => {
  let service: FinanceService;
  let prisma: PrismaService;
  let userService: UserService;
  let notificationService: NotificationService;

  const mockPrisma: any = {
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    group: {
      findUnique: jest.fn(),
    },
    groupMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    groupTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    groupExpense: {
      aggregate: jest.fn(),
    },
    groupPayment: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      update: jest.fn(),
    },
    groupGuest: {
      findMany: jest.fn(),
    },
  };

  const mockUserService = {
    getManyUsersByIds: jest.fn(),
    getUserById: jest.fn(),
  };

  const mockNotificationService = {
    sendInAppNotification: jest.fn().mockResolvedValue(undefined),
    sendGroupFeedNotification: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UserService, useValue: mockUserService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
    prisma = module.get<PrismaService>(PrismaService);
    userService = module.get<UserService>(UserService);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('summaryGroupFinance', () => {
    it('should correctly sum member requiredFee in financial summary', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 'member-id' });

      mockPrisma.groupExpense.aggregate.mockResolvedValue({ _sum: { totalAmount: 300000 } });
      mockPrisma.groupTransaction.aggregate.mockResolvedValue({ _sum: { amount: 100000 } });
      mockPrisma.groupPayment.aggregate.mockResolvedValue({ _sum: { requiredFee: 200000 } });

      mockPrisma.groupMember.findMany.mockResolvedValue([]);

      const result = await service.summaryGroupFinance('group-id', 'user-id-1');

      expect(result.data.totalExpense).toBe(300000);
      expect(result.data.totalCollected).toBe(100000);
      expect(result.data.totalRequiredCollection).toBe(200000);
      expect(result.data.outstandingAmount).toBe(100000); // 200k required - 100k collected
    });
  });

  describe('getMyDebt', () => {
    it('should include unpaid payments in my debt summary', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-id',
        creditBalance: 10000,
      });

      mockPrisma.groupPayment.findMany.mockResolvedValue([
        {
          id: 'p-1',
          requiredFee: 50000,
          amountPaid: 50000,
          status: PaymentStatus.PAID,
          expense: { title: 'Court Session 1' },
        },
        {
          id: 'p-2',
          requiredFee: 50000,
          amountPaid: 20000,
          status: PaymentStatus.PARTIALLY_PAID,
          expense: { title: 'Court Session 2' },
        },
        {
          id: 'p-3',
          requiredFee: 50000,
          amountPaid: 0,
          status: PaymentStatus.UNPAID,
          expense: { title: 'Court Session 3' },
        },
      ]);

      const result = await service.getMyDebt('group-id', 'user-id-1');

      expect(result.data.totalRequired).toBe(150000); // 50k + 50k + 50k
      expect(result.data.totalPaid).toBe(70000); // 50k + 20k + 0k
      // totalDebt = (50k - 20k) + (50k - 0k) = 80000.
      // credit = 10000.
      // netBalance = credit - totalDebt = 10000 - 80000 = -70000.
      // debt = Math.abs(netBalance) = 70000.
      expect(result.data.netBalance).toBe(-70000);
      expect(result.data.debt).toBe(70000);
      expect(result.data.unpaidPayments).toHaveLength(2);
    });
  });

  describe('listMembersWithDebt', () => {
    it('should list members with their debts', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-owner-id',
        role: GroupMemberRole.OWNER,
      });

      mockPrisma.groupMember.findMany.mockResolvedValue([
        { id: 'member-1-id', userId: 'user-id-1', creditBalance: 0 },
      ]);

      mockUserService.getManyUsersByIds.mockResolvedValue([
        { id: 'user-id-1', name: 'Member One', email: 'one@example.com' },
      ]);

      // member-1 has 20000 unpaid self fee + 50000 another unpaid fee
      mockPrisma.groupPayment.findMany.mockResolvedValue([
        {
          id: 'p-1',
          userId: 'user-id-1',
          requiredFee: 50000,
          amountPaid: 30000,
          status: PaymentStatus.PARTIALLY_PAID,
          expense: { title: 'Expense 1' },
          createdAt: new Date(),
        },
        {
          id: 'p-2',
          userId: 'user-id-1',
          requiredFee: 50000,
          amountPaid: 0,
          status: PaymentStatus.UNPAID,
          expense: { title: 'Expense 2' },
          createdAt: new Date(),
        },
      ]);

      const result = await service.listMembersWithDebt('group-id', 'member-owner-id', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      const firstDebt = result.data[0];
      expect(firstDebt.userId).toBe('user-id-1');
      // debt = (50k - 30k) + (50k - 0k) = 70000 VND
      expect(firstDebt.debt).toBe(70000);
      expect(firstDebt.unpaidPayments).toHaveLength(2);
    });
  });

  describe('verifyTransaction', () => {
    it('should verify transaction and auto-allocate to member payments in FIFO order', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id', name: 'Group Test' });
      mockPrisma.groupMember.findUnique.mockImplementation(({ where }: any) => {
        if (where.userId_groupId) {
          if (where.userId_groupId.userId === 'member-owner-id') {
            return Promise.resolve({
              id: 'member-owner-id',
              userId: 'member-owner-id',
              role: GroupMemberRole.OWNER,
            });
          }
          if (where.userId_groupId.userId === 'user-id-1') {
            return Promise.resolve({
              id: 'member-1-id',
              userId: 'user-id-1',
              creditBalance: 10000,
            });
          }
        }
        return Promise.resolve(null);
      });

      mockPrisma.groupTransaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        amount: 80000,
        userId: 'user-id-1',
        status: TransactionStatus.PENDING_REVIEW,
      });

      mockPrisma.groupTransaction.update.mockResolvedValue({
        id: 'tx-1',
        status: TransactionStatus.VERIFIED,
      });

      // two unpaid payments:
      // p-1 (createdAt: 10 mins ago) - needs 50k
      const p1CreatedAt = new Date(Date.now() - 10 * 60000);
      // p-2 (createdAt: 5 mins ago) - needs 50k
      const p2CreatedAt = new Date(Date.now() - 5 * 60000);
      mockPrisma.groupPayment.findMany.mockResolvedValue([
        {
          id: 'p-1',
          requiredFee: 50000,
          amountPaid: 0,
          status: PaymentStatus.UNPAID,
          createdAt: p1CreatedAt,
        },
        {
          id: 'p-2',
          requiredFee: 50000,
          amountPaid: 0,
          status: PaymentStatus.UNPAID,
          createdAt: p2CreatedAt,
        },
      ]);

      const result = await service.verifyTransaction('tx-1', 'group-id', 'member-owner-id', {
        status: 'VERIFIED' as any,
      });

      // FIFO order:
      // 1. p-1 (10 mins ago): takes 50k, status becomes PAID. remaining available = 90k - 50k = 40k.
      // 2. p-2 (5 mins ago): takes 40k, status becomes PARTIALLY_PAID. remaining available = 0.
      expect(mockPrisma.groupPayment.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'p-1' },
        data: {
          amountPaid: 50000,
          status: PaymentStatus.PAID,
          paidAt: expect.any(Date),
        },
      });

      expect(mockPrisma.groupPayment.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'p-2' },
        data: {
          amountPaid: 40000,
          status: PaymentStatus.PARTIALLY_PAID,
          paidAt: null,
        },
      });

      // Remaining credit balance = 0
      expect(mockPrisma.groupMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1-id' },
        data: { creditBalance: 0 },
      });

      expect(result.message).toBe('Transaction verified and auto-allocated successfully');
    });
  });
});
