import { ConflictException, ForbiddenException, Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { GroupMemberRole, Prisma, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { GroupErrors } from '../../group/errors/group.errors';
import { NotificationService } from '../../notification/notification.service';
import { UserService } from '../../user/user.service';

// DTOs
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ListExpenseQueryDto } from './dto/list-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(
    private prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
  ) { }

  // #region createExpense
  /**
   * Creates a new expense within a group and allocates payments
   * For group owners or admins only
   * @param groupId ID of the group
   * @param userId ID of the user creating the expense
   * @param createExpenseDto DTO containing expense details and allocations
   */
  async createExpense(groupId: string, userId: string, createExpenseDto: CreateExpenseDto) {
    // Check group and membership
    const [group, membership] = await Promise.all([
      this.prisma.group.findUnique({ where: { id: groupId } }),
      this.prisma.groupMember.findUnique({
        where: {
          userId_groupId: { groupId, userId },
        },
      }),
    ]);

    if (!group)
      throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);
    if (!membership)
      throw new ForbiddenException(GroupErrors.GROUP_NOT_MEMBER);

    // Check role
    const isOwner =
      membership.role === GroupMemberRole.OWNER;

    if (!isOwner)
      throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);

    // Validate allocations
    if (!createExpenseDto.allocations || createExpenseDto.allocations.length === 0) {
      throw new BadRequestException('Allocations cannot be empty');
    }

    // Verify all allocated users are group members
    const allocatedUserIds = createExpenseDto.allocations.map(a => a.userId);
    const validMembers = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        userId: { in: allocatedUserIds }
      }
    });

    if (validMembers.length !== allocatedUserIds.length) {
      throw new BadRequestException('Some allocated users are not members of the group');
    }

    // Validate total amount matches sum of allocations
    const memberSum = createExpenseDto.allocations.reduce((sum, a) => sum + a.requiredFee, 0);
    if (memberSum !== createExpenseDto.totalAmount) {
      throw new BadRequestException('The sum of allocations must equal the total expense amount');
    }

    // Validate linked activity if provided
    if (createExpenseDto.activityId) {
      const activity = await this.prisma.groupActivity.findUnique({
        where: { id: createExpenseDto.activityId },
      });
      if (!activity || activity.groupId !== groupId) {
        throw new BadRequestException('Linked activity not found in this group');
      }
    }

    // Create expense and payments in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create GroupExpense first
      const expense = await tx.groupExpense.create({
        data: {
          groupId,
          title: createExpenseDto.title,
          description: createExpenseDto.description,
          totalAmount: createExpenseDto.totalAmount,
          receiptUrl: createExpenseDto.receiptUrl,
          expenseDate: createExpenseDto.expenseDate ? new Date(createExpenseDto.expenseDate) : undefined,
          createdById: userId,
          activityId: createExpenseDto.activityId,
        }
      });

      const payments = [];

      // 2. Create GroupPayment for each allocated member, deducting from creditBalance if available
      for (const allocation of createExpenseDto.allocations) {
        const member = await tx.groupMember.findUnique({
          where: {
            userId_groupId: {
              groupId,
              userId: allocation.userId
            }
          }
        });

        const guestCount = allocation.guestCount || 0;
        const guestFee = allocation.guestFee || 0;
        const totalDue = allocation.requiredFee;

        let amountPaid = 0;
        let status: PaymentStatus = PaymentStatus.UNPAID;
        let creditDeduction = 0;

        if (member && member.creditBalance > 0) {
          creditDeduction = Math.min(member.creditBalance, totalDue);
          amountPaid = creditDeduction;
          status = creditDeduction >= totalDue ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;

          // Deduct from member's credit balance
          await tx.groupMember.update({
            where: { id: member.id },
            data: { creditBalance: member.creditBalance - creditDeduction }
          });
        }

        const payment = await tx.groupPayment.create({
          data: {
            expenseId: expense.id,
            userId: allocation.userId,
            requiredFee: allocation.requiredFee,
            guestCount,
            guestFee,
            amountPaid,
            status,
            paidAt: status === PaymentStatus.PAID ? new Date() : null
          } as any
        });

        payments.push(payment);
      }

      return {
        ...expense,
        payments
      };
    });

    const createTitle = `Khoản chi mới vừa được tạo`;
    const createMessage = `Khoản chi "${result.title}" vừa được thêm vào nhóm "${group.name}".`;
    await this.notificationService.sendInAppNotification(allocatedUserIds, createTitle, createMessage)
      .catch(err => this.logger.error('Failed to send in-app notification for new expense', err));
    await this.notificationService.sendGroupFeedNotification(groupId, createTitle, createMessage)
      .catch(err => this.logger.error('Failed to send group feed notification for new expense', err));

    return {
      message: 'Expense created successfully',
      data: result
    }
  }
  // #endregion

  // #region getExpenses
  /**
   * Lists all expenses within a group with pagination and filtering
   * @param groupId ID of the group
   * @param userId ID of the user requesting the list
   * @param listExpenseQueryDto DTO containing pagination, search, and sorting filters
   */
  async getExpenses(groupId: string, userId: string, listExpenseQueryDto: ListExpenseQueryDto) {
    // Pagination and filtering
    const page = listExpenseQueryDto.page ?? 1;
    const limit = listExpenseQueryDto.limit ?? 10;
    const offset = (page - 1) * limit;

    // Check group and member
    const [group, membership] = await Promise.all([
      this.prisma.group.findUnique({ where: { id: groupId } }),
      this.prisma.groupMember.findUnique({
        where: {
          userId_groupId: { groupId, userId },
        },
      }),
    ]);

    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);
    if (!membership) throw new ForbiddenException(GroupErrors.GROUP_NOT_MEMBER);

    // Build query conditions
    const where: Prisma.GroupExpenseWhereInput = { groupId };

    // Apply search filter
    if (listExpenseQueryDto.search) {
      where.OR = [
        { title: { contains: listExpenseQueryDto.search, mode: 'insensitive' } },
        { description: { contains: listExpenseQueryDto.search, mode: 'insensitive' } }
      ];
    }

    // Apply sorting — map user-facing sort key to actual Prisma field name
    const SORT_FIELD_MAP: Record<string, string> = {
      deadline: 'expenseDate',
      amount: 'totalAmount',
    };
    const sortField = SORT_FIELD_MAP[listExpenseQueryDto.sortBy ?? ''] ?? 'createdAt';
    const orderBy = { [sortField]: listExpenseQueryDto.order ?? 'desc' };


    // Filter userId
    if (listExpenseQueryDto.userId) {
      where.createdById = listExpenseQueryDto.userId;
    }

    // Get user info
    const userMap: Record<string, { id: string; name: string; email: string; avatarUrl: string | null }> = {};
    // If filtering by userId, only fetch that user.
    if (listExpenseQueryDto.userId) {
      const user = await this.userService.getUserById(listExpenseQueryDto.userId);
      if (user) {
        userMap[user.id] = user;
      }

      // Otherwise, fetch all users who created expenses in this group
    } else {
      const userIds = await this.prisma.groupExpense.findMany({
        where,
        select: { createdById: true },
        distinct: ['createdById']
      }).then(expenses => expenses.map(e => e.createdById));
      const users = await this.userService.getManyUsersByIds(userIds);
      users.forEach(user => {
        userMap[user.id] = user;
      });
    }

    // Fetch expenses with pagination, filtering, and sorting
    const expenses = await this.prisma.groupExpense.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit
    });

    // Map user info to expenses
    const result = expenses.map(expense => ({
      ...expense,
      createdBy: {
        id: expense.createdById,
        name: userMap[expense.createdById]?.name || null,
        email: userMap[expense.createdById]?.email || null,
        avatarUrl: userMap[expense.createdById]?.avatarUrl || null,
      }
    }));

    // Get total count for pagination
    const total = await this.prisma.groupExpense.count({
      where,
    });

    return {
      message: 'Get expenses successfully',
      data: result,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      }
    }
  }
  // #endregion

  // #region getDetailsById
  /**
   * Gets detail information of an expense by ID
   * including status of payments for members
   * @param expenseId ID of the expense
   * @param groupId ID of the group
   * @param userId ID of the user requesting the details
   */
  async getDetailsById(expenseId: string, groupId: string, userId: string) {
    // Check group and member
    const [group, membership] = await Promise.all([
      this.prisma.group.findUnique({ where: { id: groupId } }),
      this.prisma.groupMember.findUnique({
        where: {
          userId_groupId: { groupId, userId },
        },
      }),
    ]);

    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);
    if (!membership) throw new ForbiddenException(GroupErrors.GROUP_NOT_MEMBER);

    // Get expense
    const expense = await this.prisma.groupExpense.findFirst({
      where: {
        id: expenseId,
        groupId
      },
      include: {
        payments: true
      }
    });

    // If expense not found, throw 404
    if (!expense) throw new NotFoundException('Expense not found');

    // Get user info for creator, payments, and guest inviters
    const userIdsToFetch = new Set<string>();
    userIdsToFetch.add(expense.createdById);
    expense.payments.forEach(p => {
      userIdsToFetch.add(p.userId);
      if (p.verifiedById) userIdsToFetch.add(p.verifiedById);
    });

    const users = await this.userService.getManyUsersByIds(Array.from(userIdsToFetch));
    const userMap = new Map(users.map((user) => [user.id, user]));

    const creator = userMap.get(expense.createdById);

    const data = {
      ...expense,
      createdBy: creator ? {
        id: creator.id,
        name: creator.name,
        email: creator.email,
        avatarUrl: creator.avatarUrl,
      } : null,
      payments: expense.payments.map(payment => {
        const pUser = userMap.get(payment.userId);
        const pVerifier = payment.verifiedById ? userMap.get(payment.verifiedById) : null;
        return {
          ...payment,
          user: pUser ? {
            id: pUser.id,
            name: pUser.name,
            email: pUser.email,
            avatarUrl: pUser.avatarUrl,
          } : null,
          verifiedBy: pVerifier ? {
            id: pVerifier.id,
            name: pVerifier.name,
            email: pVerifier.email,
            avatarUrl: pVerifier.avatarUrl,
          } : null
        }
      })
    }

    return {
      message: 'Get expense details successfully',
      data: data
    };
  }
  // #endregion

  // #region updateExpense
  /**
   * Updates details of an existing expense
   * For group owners or admins only
   * @param expenseId ID of the expense to update
   * @param groupId ID of the group
   * @param userId ID of the Admin/Owner updating the expense
   * @param updateExpenseDto DTO containing the fields to update
   */
  async updateExpense(expenseId: string, groupId: string, userId: string, updateExpenseDto: UpdateExpenseDto) {
    // Check group and member
    const [group, membership] = await Promise.all([
      this.prisma.group.findUnique({ where: { id: groupId } }),
      this.prisma.groupMember.findUnique({
        where: {
          userId_groupId: { groupId, userId },
        },
      }),
    ]);

    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);
    if (!membership) throw new ForbiddenException(GroupErrors.GROUP_NOT_MEMBER);

    // Check if user is an owner
    const isOwner =
      membership.role === GroupMemberRole.OWNER;
    if (!isOwner) throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);

    // Get expense
    const expense = await this.prisma.groupExpense.findFirst({
      where: {
        id: expenseId,
        groupId
      }
    });

    // If expense not found, throw 404
    if (!expense) throw new NotFoundException('Expense not found');

    if (updateExpenseDto.totalAmount !== undefined && Number(updateExpenseDto.totalAmount) < 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    // Build update data object
    const data: Prisma.GroupExpenseUpdateInput = {};
    if (updateExpenseDto.title !== undefined) data.title = updateExpenseDto.title;
    if (updateExpenseDto.description !== undefined) data.description = updateExpenseDto.description;
    if (updateExpenseDto.totalAmount !== undefined) data.totalAmount = updateExpenseDto.totalAmount;
    if (updateExpenseDto.receiptUrl !== undefined) data.receiptUrl = updateExpenseDto.receiptUrl;
    if (updateExpenseDto.expenseDate !== undefined) data.expenseDate = new Date(updateExpenseDto.expenseDate);

    if (updateExpenseDto.activityId !== undefined) {
      if (updateExpenseDto.activityId !== null) {
        const activity = await this.prisma.groupActivity.findUnique({
          where: { id: updateExpenseDto.activityId },
        });
        if (!activity || activity.groupId !== groupId) {
          throw new BadRequestException('Linked activity not found in this group');
        }
        data.activity = { connect: { id: updateExpenseDto.activityId } };
      } else {
        data.activity = { disconnect: true };
      }
    }

    // Update expense
    const result = await this.prisma.groupExpense.update({
      where: { id: expenseId },
      data
    })

    // Send notification to group members about the update
    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const userIds = members.map((member) => member.userId);
    const expenseTitle = updateExpenseDto.title ?? expense.title;
    const updateTitle = 'Khoản chi đã được cập nhật';
    const updateMessage = `Khoản chi "${expenseTitle}" vừa được cập nhật.`;
    await this.notificationService.sendInAppNotification(userIds, updateTitle, updateMessage)
      .catch(err => this.logger.error('Failed to send in-app notification for updated expense', err));
    await this.notificationService.sendGroupFeedNotification(groupId, updateTitle, updateMessage)
      .catch(err => this.logger.error('Failed to send group feed notification for updated expense', err));

    return {
      message: 'Expense updated successfully',
      data: result,
    };
  }
  // #endregion

  // #region deleteExpense
  /**
   * Deletes an expense by ID and its associated payments
   * For group owners or admins only
   * @param expenseId ID of the expense to delete
   * @param groupId ID of the group
   * @param userId ID of the Admin/Owner deleting the expense
   */
  async deleteExpense(expenseId: string, groupId: string, userId: string) {
    // Check group and member
    const [group, membership] = await Promise.all([
      this.prisma.group.findUnique({ where: { id: groupId } }),
      this.prisma.groupMember.findUnique({
        where: {
          userId_groupId: { groupId, userId },
        },
      }),
    ]);

    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);
    if (!membership) throw new ForbiddenException(GroupErrors.GROUP_NOT_MEMBER);

    // Check role
    const isOwner =
      membership.role === GroupMemberRole.OWNER;
    if (!isOwner) throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);

    // Delete expense
    const res = await this.prisma.groupExpense.deleteMany({
      where: {
        id: expenseId,
        groupId
      },
    });

    if (res.count === 0) {
      throw new NotFoundException('Expense not found');
    }

    return {
      message: 'Expense deleted successfully'
    }
  }
  // #endregion
}