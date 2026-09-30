import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseService } from './expense.service';
import { PrismaService } from '../../prisma.service';
import { UserService } from '../../user/user.service';
import { NotificationService } from '../../notification/notification.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { GroupMemberRole, PaymentStatus, TransactionStatus } from '@prisma/client';
import { CreateExpenseDto } from './dto/create-expense.dto';

describe('ExpenseService', () => {
  let service: ExpenseService;
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
    },
    groupActivity: {
      findUnique: jest.fn(),
    },
    sessionAttendance: {
      findMany: jest.fn(),
    },
    groupExpense: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    groupPayment: {
      create: jest.fn(),
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
        ExpenseService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UserService, useValue: mockUserService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<ExpenseService>(ExpenseService);
    prisma = module.get<PrismaService>(PrismaService);
    userService = module.get<UserService>(UserService);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createExpense', () => {
    const dto: CreateExpenseDto = {
      title: 'Weekly Play Session',
      description: 'Court booking fee',
      totalAmount: 100000,
      expenseDate: '2026-06-25T18:00:00.000Z',
      allocations: [
        { userId: 'user-id-1', requiredFee: 50000 },
        { userId: 'user-id-2', requiredFee: 50000 },
      ],
    };

    it('should throw NotFoundException if group does not exist', async () => {
      mockPrisma.group.findUnique.mockResolvedValue(null);

      await expect(service.createExpense('group-id', 'user-id-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not a member of the group', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue(null);

      await expect(service.createExpense('group-id', 'user-id-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user is not the group owner', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        userId: 'user-id-2',
        role: GroupMemberRole.MEMBER,
      });

      await expect(service.createExpense('group-id', 'user-id-2', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if allocations is empty', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        userId: 'user-id-1',
        role: GroupMemberRole.OWNER,
      });

      const invalidDto = { ...dto, allocations: [] };
      await expect(service.createExpense('group-id', 'user-id-1', invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if some allocated users are not group members', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        userId: 'user-id-1',
        role: GroupMemberRole.OWNER,
      });
      mockPrisma.groupMember.findMany.mockResolvedValue([
        { userId: 'user-id-1' }, // user-id-2 is missing
      ]);

      await expect(service.createExpense('group-id', 'user-id-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if total sum does not match totalAmount', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        userId: 'user-id-1',
        role: GroupMemberRole.OWNER,
      });
      mockPrisma.groupMember.findMany.mockResolvedValue([
        { userId: 'user-id-1' },
        { userId: 'user-id-2' },
      ]);

      const invalidDto = { ...dto, totalAmount: 999999 };
      await expect(service.createExpense('group-id', 'user-id-1', invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should successfully create expense and deduct creditBalance from members', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id', name: 'Pickleball Group' });
      mockPrisma.groupMember.findUnique.mockImplementation(({ where }: any) => {
        if (where.userId_groupId) {
          return Promise.resolve({
            id: 'member-owner-id',
            userId: 'user-id-1',
            role: GroupMemberRole.OWNER,
            creditBalance: 100000,
          });
        }
        return Promise.resolve(null);
      });

      mockPrisma.groupMember.findMany.mockResolvedValue([
        { userId: 'user-id-1' },
        { userId: 'user-id-2' },
      ]);

      mockPrisma.groupExpense.create.mockResolvedValue({
        id: 'expense-id',
        title: dto.title,
        totalAmount: dto.totalAmount,
      });

      mockPrisma.groupPayment.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'payment-id', ...data }));

      const result = await service.createExpense('group-id', 'user-id-1', dto);

      expect(mockPrisma.groupExpense.create).toHaveBeenCalled();
      expect(mockPrisma.groupPayment.create).toHaveBeenCalledTimes(2);

    });
  });

  describe('getDetailsById', () => {
    it('should throw NotFoundException if expense does not exist', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 'member-id' });
      mockPrisma.groupExpense.findFirst.mockResolvedValue(null);

      await expect(service.getDetailsById('expense-id', 'group-id', 'user-id-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return expense details with user information', async () => {
      mockPrisma.group.findUnique.mockResolvedValue({ id: 'group-id' });
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-id',
        userId: 'user-id-1',
      });
      mockPrisma.groupExpense.findFirst.mockResolvedValue({
        id: 'expense-id',
        title: 'Weekly Session',
        createdById: 'user-id-1',
        payments: [
          { userId: 'user-id-1', requiredFee: 50000, amountPaid: 50000, status: PaymentStatus.PAID },
        ],
      });

      mockUserService.getManyUsersByIds.mockResolvedValue([
        { id: 'user-id-1', name: 'Owner User', email: 'owner@example.com', avatarUrl: 'avatar-1' },
      ]);

      const result = await service.getDetailsById('expense-id', 'group-id', 'user-id-1');

      expect(result.message).toBe('Get expense details successfully');
      expect(result.data.createdBy!.name).toBe('Owner User');
    });
  });
});
