import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { GroupErrors } from "../group/errors/group.errors";
import { Prisma, PaymentStatus } from "@prisma/client";
import { FinanceSummaryQueryDto } from "./dto/finance-summary-query.dto";
import { ListCreditBalanceQueryDto } from "./dto/list-credit-balance.dto";
import { UserService } from "../user/user.service";
import { NotificationService } from "../notification/notification.service";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { ListTransactionQueryDto } from "./dto/list-transaction.dto";
import { VerifyTransactionDto, VerifyTransactionStatus } from "./dto/verify-transaction.dto";
import { RemindFeeDto } from "./dto/remind-fee.dto";
import { ListDebtsQueryDto } from "./dto/list-debts-query.dto";
import { GroupMemberRole, TransactionStatus } from "@prisma/client";
import { RefundMemberDto } from "../group/dto/refund-member.dto";

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly notificationService: NotificationService,
  ) { }

  // #region summaryGroupFinance
  /**
   * Summarizes the financial status of a group
   * including total admin spent, total collected, required collections, expected revenue, outstanding amount, and members with credit balance
   * @param groupId ID of the group
   * @param userId ID of the user requesting the summary
   * @param filters Filters by date range
   */
  async summaryGroupFinance(groupId: string, userId: string, filters?: FinanceSummaryQueryDto) {
    // Validate group and membership
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

    // Build date filter for query
    const dateFilter = this.buildDateFilter(filters?.fromDate, filters?.toDate);
    const expenseWhere: Prisma.GroupExpenseWhereInput = {
      groupId,
      ...(dateFilter ? { expenseDate: dateFilter } : {}),
    };

    // Get total expense, total collected, and total required collection
    const [
      // total expense amount
      totalExpenseAmount,

      // total collected amount
      totalCollectedAmount,

      // total required collection amount
      totalRequiredAmount,
    ] = await Promise.all([
      // get total expense amount by sum totalAmount of all expenses
      this.prisma.groupExpense.aggregate({
        where: expenseWhere,
        _sum: {
          totalAmount: true,
        },
      }),

      // get total collected amount by sum amount of all verified transactions
      this.prisma.groupTransaction.aggregate({
        where: {
          groupId,
          status: TransactionStatus.VERIFIED,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        _sum: {
          amount: true,
        },
      }),

      // get total required collection by sum requiredFee of all group payments
      this.prisma.groupPayment.aggregate({
        where: {
          expense: {
            groupId,
            ...(dateFilter ? { expenseDate: dateFilter } : {}),
          },
        },
        _sum: {
          requiredFee: true,
        },
      }),
    ]);

    // calculate financial metrics
    const totalExpense = totalExpenseAmount._sum.totalAmount ?? 0;
    const totalCollected = totalCollectedAmount._sum.amount ?? 0;
    const totalRequiredCollection = totalRequiredAmount._sum.requiredFee ?? 0;
    const totalExpectedRevenue = totalRequiredCollection;
    const outstandingAmount = totalExpectedRevenue - totalCollected;
    const netBalance = totalCollected - totalExpense;

    // query members with positive credit balance directly from groupMember
    const creditMembers = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        creditBalance: { gt: 0 }
      }
    });

    const userIds = creditMembers.map(c => c.userId);
    const users = userIds.length > 0 ? await this.userService.getManyUsersByIds(userIds) : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const creditBalancesWithUser = creditMembers.map(c => ({
      userId: c.userId,
      creditBalance: c.creditBalance,
      user: userMap.get(c.userId) || null
    }));

    return {
      message: 'Get finance summary successfully',
      data: {
        totalExpense,
        totalRequiredCollection,
        totalExpectedRevenue,
        totalCollected,
        outstandingAmount,
        netBalance,
        creditBalanceList: creditBalancesWithUser
      },
    };
  }
  // #endregion

  // #region listMembersWithCreditBalance
  /**
   * Lists group members with positive credit balance
   * including user info, pagination, and simple filters
   * @param groupId ID of the group
   * @param userId ID of the user requesting the list
   * @param query Pagination and minimum credit filters
   */
  async listMembersWithCreditBalance(
    groupId: string,
    userId: string,
    query: ListCreditBalanceQueryDto,
  ) {
    // Pagination
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    // Check group and membership
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

    const minCredit = query.minCredit ?? 0;

    const whereMember: Prisma.GroupMemberWhereInput = {
      groupId,
      creditBalance: { gt: minCredit },
      ...(query.userId ? { userId: query.userId } : {})
    };

    const [membersWithCredit, total] = await Promise.all([
      this.prisma.groupMember.findMany({
        where: whereMember,
        skip: offset,
        take: limit,
        orderBy: { creditBalance: 'desc' }
      }),
      this.prisma.groupMember.count({ where: whereMember })
    ]);

    const userIds = membersWithCredit.map(c => c.userId);
    const users = userIds.length > 0 ? await this.userService.getManyUsersByIds(userIds) : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const data = membersWithCredit.map(c => ({
      userId: c.userId,
      creditBalance: c.creditBalance,
      user: userMap.get(c.userId) || null
    }));

    return {
      message: "Get credit balance list successfully",
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
  // #endregion

  // #region getMyDebt
  /**
   * Gets the total debt and details of unpaid payments for a specific user
   * @param groupId ID of the group
   * @param userId ID of the member
   */
  async getMyDebt(groupId: string, userId: string) {
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

    // Sum requiredFee and amountPaid
    const [payments] = await Promise.all([
      this.prisma.groupPayment.findMany({
        where: {
          expense: { groupId },
          userId
        },
        include: { expense: true }
      })
    ]);

    let totalRequired = 0;
    let totalPaid = 0;
    let totalDebt = 0;
    const unpaidPayments = [];

    for (const p of payments) {
      totalRequired += p.requiredFee;
      totalPaid += p.amountPaid;
      if (p.requiredFee > p.amountPaid) {
        const debt = p.requiredFee - p.amountPaid;
        totalDebt += debt;
        unpaidPayments.push({
          id: p.id,
          expenseTitle: p.expense.title,
          requiredFee: p.requiredFee,
          guestCount: p.guestCount,
          guestFee: p.guestFee,
          amountPaid: p.amountPaid,
          debt,
          status: p.status
        });
      }
    }

    // guest payments checks removed

    const credit = membership.creditBalance;
    const netBalance = credit - totalDebt; // positive = credit, negative = debt

    return {
      message: 'Get my debt successfully',
      data: {
        totalRequired,
        totalPaid,
        netBalance,
        debt: netBalance < 0 ? Math.abs(netBalance) : 0,
        unpaidPayments
      }
    };
  }
  // #endregion

  // #region listMembersWithDebt
  /**
   * Lists group members with outstanding debt
   * including user details, breakdown of unpaid payments, pagination, and search filters
   * @param groupId ID of the group
   * @param userId ID of the user requesting the list
   * @param query DTO containing pagination and search filters
   */
  async listMembersWithDebt(
    groupId: string,
    userId: string,
    query: ListDebtsQueryDto,
  ) {
    // Check group and membership
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

    // Only OWNER can view the group-wide debts list
    const isOwner =
      membership.role === GroupMemberRole.OWNER;
    if (!isOwner) throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);

    // Fetch all members in the group
    const members = await this.prisma.groupMember.findMany({
      where: { groupId }
    });

    const userIds = members.map(m => m.userId);
    const users = userIds.length > 0 ? await this.userService.getManyUsersByIds(userIds) : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    // Filter members by search query if provided (matching name or email case-insensitively)
    let filteredMembers = members;
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredMembers = members.filter(member => {
        const user = userMap.get(member.userId);
        if (!user) return false;
        return (
          user.name.toLowerCase().includes(searchLower) ||
          (user.email && user.email.toLowerCase().includes(searchLower))
        );
      });
    }

    // Fetch all payments for the group to compute debts in memory
    const [payments] = await Promise.all([
      this.prisma.groupPayment.findMany({
        where: {
          expense: { groupId }
        },
        include: { expense: true }
      })
    ]);

    // Group payments by userId
    const userPaymentsMap = new Map<string, typeof payments>();
    for (const p of payments) {
      if (!userPaymentsMap.has(p.userId)) {
        userPaymentsMap.set(p.userId, []);
      }
      userPaymentsMap.get(p.userId)!.push(p);
    }

    const indebtedMembers = [];
    for (const member of filteredMembers) {
      const userPayments = userPaymentsMap.get(member.userId) ?? [];
      let totalRequired = 0;
      let totalPaid = 0;
      let totalDebt = 0;
      const unpaidPayments = [];

      for (const p of userPayments) {
        totalRequired += p.requiredFee;
        totalPaid += p.amountPaid;
        if (p.requiredFee > p.amountPaid) {
          const debt = p.requiredFee - p.amountPaid;
          totalDebt += debt;
          unpaidPayments.push({
            id: p.id,
            expenseTitle: p.expense.title,
            requiredFee: p.requiredFee,
            guestCount: p.guestCount,
            guestFee: p.guestFee,
            amountPaid: p.amountPaid,
            debt,
            status: p.status,
            createdAt: p.createdAt
          });
        }
      }

      const credit = member.creditBalance;
      const netBalance = credit - totalDebt;
      const netDebt = netBalance < 0 ? Math.abs(netBalance) : 0;

      if (netDebt > 0) {
        indebtedMembers.push({
          userId: member.userId,
          creditBalance: credit,
          totalRequired,
          totalPaid,
          netBalance,
          debt: netDebt,
          unpaidPayments,
          user: userMap.get(member.userId) || null
        });
      }
    }

    // Sort indebted members by debt descending
    indebtedMembers.sort((a, b) => b.debt - a.debt);

    // Paginate
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const total = indebtedMembers.length;
    const paginated = indebtedMembers.slice((page - 1) * limit, page * limit);

    return {
      message: 'Get group debts list successfully',
      data: paginated,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }
  // #endregion

  // #region remindDebt
  /**
   * Sends debt reminder notifications to indebted group members
   * @param groupId ID of the group
   * @param adminUserId ID of the Admin performing the action
   * @param dto DTO containing specific user IDs to remind and email settings
   */
  async remindDebt(groupId: string, adminUserId: string, dto: RemindFeeDto) {
    const [group, membership] = await Promise.all([
      this.prisma.group.findUnique({ where: { id: groupId } }),
      this.prisma.groupMember.findUnique({
        where: {
          userId_groupId: { groupId, userId: adminUserId },
        },
      }),
    ]);

    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);
    if (!membership) throw new ForbiddenException(GroupErrors.GROUP_NOT_MEMBER);

    const isOwner =
      membership.role === GroupMemberRole.OWNER;
    if (!isOwner) throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);

    // Get all users' payment aggregates
    const userPayments = await this.prisma.groupPayment.groupBy({
      by: ['userId'],
      where: {
        expense: { groupId },
        ...(dto.userIds && dto.userIds.length > 0 ? { userId: { in: dto.userIds } } : {})
      },
      _sum: {
        amountPaid: true,
        requiredFee: true
      }
    });

    const members = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        ...(dto.userIds && dto.userIds.length > 0 ? { userId: { in: dto.userIds } } : {})
      }
    });
    const memberMap = new Map(members.map(m => [m.userId, m]));

    const indebtedUsers = [];
    const debtMap = new Map<string, number>();

    for (const p of userPayments) {
      const member = memberMap.get(p.userId);
      if (!member) continue;

      const amountPaid = p._sum.amountPaid ?? 0;
      const requiredFee = p._sum.requiredFee ?? 0;
      const totalDebt = requiredFee - amountPaid;
      
      const credit = member.creditBalance;
      const netBalance = credit - totalDebt;
      const netDebt = netBalance < 0 ? Math.abs(netBalance) : 0;

      if (netDebt > 0) {
        indebtedUsers.push(p);
        debtMap.set(p.userId, netDebt);
      }
    }

    const userIdsToRemind = indebtedUsers.map(u => u.userId);

    if (userIdsToRemind.length > 0) {
      // Send personalized in-app notifications
      for (const userId of userIdsToRemind) {
        const debtAmount = debtMap.get(userId) ?? 0;
        await this.notificationService.sendInAppNotification(
          [userId],
          'Nhắc nhở thanh toán',
          `Bạn đang có công nợ ${debtAmount.toLocaleString('vi-VN')} VND tại nhóm ${group.name}. Vui lòng thanh toán sớm!`
        ).catch(err => {
          this.logger.error(`Failed to send in-app notification to user ${userId}:`, err);
        });
      }

      if (dto.sendEmail) {
        const users = await this.userService.getManyUsersByIds(userIdsToRemind);
        for (const user of users) {
          if (user.email) {
            const debtAmount = debtMap.get(user.id) ?? 0;
            // Format debtAmount as Vietnamese localized string for the email template
            const formattedDebt = debtAmount.toLocaleString('vi-VN');
            this.notificationService.sendDebtReminderEmail(
              user.email,
              user.name,
              group.name,
              formattedDebt
            ).catch(err => {
              this.logger.error(`Failed to send debt reminder email to user ${user.id}:`, err);
            });
          }
        }
      }
    }

    return {
      message: 'Reminders sent successfully',
      data: {
        usersNotified: userIdsToRemind.length
      }
    };
  }
  // #endregion

  // #region createTransaction
  /**
   * Submits a new bulk transaction with a receipt URL for review
   * @param groupId ID of the group
   * @param userId ID of the member submitting the transaction
   * @param dto DTO containing the amount and receipt URL
   */
  async createTransaction(groupId: string, userId: string, dto: CreateTransactionDto) {
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

    const transaction = await this.prisma.groupTransaction.create({
      data: {
        groupId,
        userId,
        amount: dto.amount,
        receiptUrl: dto.receiptUrl,
        status: TransactionStatus.PENDING_REVIEW
      }
    });

    return {
      message: 'Transaction submitted successfully. Please wait for admin verification.',
      data: transaction
    };
  }
  // #endregion

  // #region listTransactions
  /**
   * Lists bulk transactions of a group (For admin use only)
   * @param groupId ID of the group
   * @param userId ID of the Admin requesting the list
   * @param query DTO containing pagination and status filters
   */
  async listTransactions(groupId: string, userId: string, query: ListTransactionQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

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

    const isOwner =
      membership.role === GroupMemberRole.OWNER;
    if (!isOwner) throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);

    const where: Prisma.GroupTransactionWhereInput = {
      groupId,
      ...(query.status ? { status: query.status } : {})
    };

    const [transactions, total] = await Promise.all([
      this.prisma.groupTransaction.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.groupTransaction.count({ where })
    ]);

    const userIds = transactions.map(t => t.userId);
    const users = userIds.length > 0 ? await this.userService.getManyUsersByIds(userIds) : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const data = transactions.map(t => ({
      ...t,
      user: userMap.get(t.userId) || null
    }));

    return {
      message: 'List transactions successfully',
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      }
    };
  }
  // #endregion

  // #region verifyTransaction
  /**
   * Approves or rejects a transaction, and performs FIFO auto-allocation if approved
   * @param txId ID of the transaction to verify
   * @param groupId ID of the group
   * @param adminUserId ID of the Admin verifying the transaction
   * @param dto DTO containing the verification status (VERIFIED or REJECTED)
   */
  async verifyTransaction(txId: string, groupId: string, adminUserId: string, dto: VerifyTransactionDto) {
    const [group, membership] = await Promise.all([
      this.prisma.group.findUnique({ where: { id: groupId } }),
      this.prisma.groupMember.findUnique({
        where: {
          userId_groupId: { groupId, userId: adminUserId },
        },
      }),
    ]);

    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);
    if (!membership) throw new ForbiddenException(GroupErrors.GROUP_NOT_MEMBER);

    const isOwner =
      membership.role === GroupMemberRole.OWNER;
    if (!isOwner) throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);

    const transaction = await this.prisma.groupTransaction.findUnique({
      where: { id: txId }
    });

    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.status !== TransactionStatus.PENDING_REVIEW) {
      throw new BadRequestException('Transaction is not pending review');
    }

    if (dto.status === VerifyTransactionStatus.REJECTED) {
      const updated = await this.prisma.groupTransaction.update({
        where: { id: txId },
        data: {
          status: TransactionStatus.REJECTED,
          verifiedById: adminUserId
        }
      });

      await this.notificationService.sendInAppNotification(
        [transaction.userId],
        'Giao dịch bị từ chối',
        `Giao dịch thanh toán ${transaction.amount} VND của bạn đã bị từ chối.`
      ).catch(err => this.logger.error('Failed to send in-app notification for rejected transaction', err));

      return { message: 'Transaction rejected successfully', data: updated };
    }

    // Auto-allocate logic inside Prisma transaction
    return this.prisma.$transaction(async (tx) => {
      // Mark transaction as VERIFIED
      const updatedTx = await tx.groupTransaction.update({
        where: { id: txId },
        data: {
          status: TransactionStatus.VERIFIED,
          verifiedById: adminUserId
        }
      });

      // Get current member's credit balance
      const member = await tx.groupMember.findUnique({
        where: {
          userId_groupId: {
            groupId,
            userId: transaction.userId
          }
        }
      });
      if (!member) throw new NotFoundException('Member not found');

      // Total available amount to pay debts (new payment + current credit balance)
      let totalAvailable = transaction.amount + member.creditBalance;

      // Find all unpaid or partially paid member payments, FIFO
      const memberPayments = await tx.groupPayment.findMany({
        where: {
          expense: { groupId },
          userId: transaction.userId,
          status: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIALLY_PAID] }
        },
        orderBy: { createdAt: 'asc' }
      });

      for (const payment of memberPayments) {
        if (totalAvailable <= 0) break;

        const currentDebt = payment.requiredFee - payment.amountPaid;
        if (currentDebt <= 0) continue;

        const amountToDeduct = Math.min(totalAvailable, currentDebt);
        const newAmountPaid = payment.amountPaid + amountToDeduct;
        totalAvailable -= amountToDeduct;

        let newStatus: PaymentStatus = payment.status;
        if (newAmountPaid >= payment.requiredFee) {
          newStatus = PaymentStatus.PAID;
        } else {
          newStatus = PaymentStatus.PARTIALLY_PAID;
        }

        await tx.groupPayment.update({
          where: { id: payment.id },
          data: {
            amountPaid: newAmountPaid,
            status: newStatus,
            paidAt: newAmountPaid >= payment.requiredFee ? new Date() : null
          }
        });
      }

      // Save remaining amount back to member's credit balance
      await tx.groupMember.update({
        where: { id: member.id },
        data: { creditBalance: totalAvailable }
      });

      await this.notificationService.sendInAppNotification(
        [transaction.userId],
        'Thanh toán thành công',
        `Giao dịch thanh toán ${transaction.amount} VND của bạn đã được xác nhận và cấn trừ nợ.`
      ).catch(err => this.logger.error('Failed to send in-app notification for verified transaction', err));

      return {
        message: 'Transaction verified and auto-allocated successfully',
        data: updatedTx
      };
    });
  }
  // #endregion

  // #region refundMemberCredit
  /**
   * Refunds a member's credit balance outside the system
   * For group owners or admins only
   * @param callerId ID of the admin/owner initiating the refund
   * @param groupId ID of the group
   * @param memberId ID of the member receiving the refund
   * @param dto DTO containing the refund amount
   */
  async refundMemberCredit(
    callerId: string,
    groupId: string,
    memberId: string,
    dto: RefundMemberDto,
  ) {
    const caller = await this.userService.getUserById(callerId) as any;
    if (!caller) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException(GroupErrors.GROUP_NOT_FOUND);

    const membership = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: callerId, groupId } },
    });

    const isOwner =
      membership?.role === GroupMemberRole.OWNER;

    if (!isOwner && caller?.role !== 'ADMIN') {
      throw new ForbiddenException(GroupErrors.GROUP_NOT_OWNER);
    }

    await this.prisma.$transaction(async (tx) => {
      const targetMember = await tx.groupMember.findUnique({
        where: { userId_groupId: { userId: memberId, groupId } },
      });

      if (!targetMember) {
        throw new NotFoundException('Member not found');
      }

      const refundAmount = dto.refundAmount;
      const currentCredit = targetMember.creditBalance ?? 0;

      if (refundAmount > currentCredit) {
        throw new BadRequestException('Refund amount exceeds member credit balance');
      }

      await tx.groupMember.update({
        where: { userId_groupId: { userId: memberId, groupId } },
        data: {
          creditBalance: currentCredit - refundAmount,
        },
      });
    });

    return {
      message: 'Refund processed successfully',
    };
  }
  // #endregion

  // #region buildDateFilter
  /**
   * Helper to build date range filter for Prisma queries
   * @param fromDate Start date string
   * @param toDate End date string
   */
  private buildDateFilter(fromDate?: string, toDate?: string): Prisma.DateTimeFilter | undefined {
    if (!fromDate && !toDate) return undefined;

    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;

    if (from && Number.isNaN(from.getTime())) {
      throw new BadRequestException('fromDate must be a valid ISO date string');
    }

    if (to && Number.isNaN(to.getTime())) {
      throw new BadRequestException('toDate must be a valid ISO date string');
    }

    const filter: Prisma.DateTimeFilter = {};
    if (from) filter.gte = from;
    if (to) filter.lte = to;
    return filter;
  }
  // #endregion
}