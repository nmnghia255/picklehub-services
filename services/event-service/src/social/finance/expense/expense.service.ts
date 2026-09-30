import { ConflictException, ForbiddenException, Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, SocialParticipantStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma.service';
import { SocialErrors } from '../../errors/social.errors';
import { NotificationService } from '../../../notification/notification.service';
import { UserService } from '../../../user/user.service';

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

  /**
   * Helper check social and user is organizer of the social
   * @param socialId 
   * @param userId 
   * @returns social, organizer
   */
  private async checkSocialAndCreator(socialId: string, userId: string) {
    const social = await this.prisma.social.findUnique({ where: { id: socialId } });
    if (!social) throw new NotFoundException(SocialErrors.SOCIAL_NOT_FOUND.message);

    const isCreator = social.creatorId === userId;
    if (!isCreator) {
      throw new ForbiddenException(SocialErrors.SOCIAL_NOT_OWNER.message);
    }

    const participant = await this.prisma.socialParticipant.findUnique({
      where: {
        socialId_userId: { socialId, userId },
      },
    });

    return { social, participant };
  }

  /**
   * Helper check social and user is participant of the social
   * @param socialId 
   * @param userId 
   * @returns social, participant
   */
  private async checkSocialAndParticipant(socialId: string, userId: string) {
    const [social, participant] = await Promise.all([
      this.prisma.social.findUnique({ where: { id: socialId } }),
      this.prisma.socialParticipant.findUnique({
        where: {
          socialId_userId: { socialId, userId },
        },
      }),
    ]);

    if (!social) throw new NotFoundException(SocialErrors.SOCIAL_NOT_FOUND.message);
    if (!participant || participant.status === SocialParticipantStatus.CANCELLED) {
      throw new ForbiddenException(SocialErrors.SOCIAL_NOT_PARTICIPANT.message);
    }

    return { social, participant };
  }

  /**
   * Recalculates and updates the totalExpense on the Social model
   * @param socialId 
   */
  private async updateSocialTotalExpense(socialId: string) {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: { totalBookingCost: true },
    });
    const totalBookingCost = social?.totalBookingCost ?? 0;

    const aggregate = await this.prisma.socialExpense.aggregate({
      where: { socialId },
      _sum: {
        amount: true,
      },
    });
    const sumExpenses = aggregate._sum.amount ?? 0;
    const totalExpense = totalBookingCost + sumExpenses;

    await this.prisma.social.update({
      where: { id: socialId },
      data: { totalExpense },
    });
  }

  /**
   * Creates a new expense within a social
   * For social organizers only
   * @param socialId 
   * @param userId 
   * @param createExpenseDto 
   * @returns 
   */
  async createExpense(socialId: string, userId: string, createExpenseDto: CreateExpenseDto) {
    // Check social and organizer role
    const { social } = await this.checkSocialAndCreator(socialId, userId);

    if (social.status === 'COMPLETED' || social.status === 'CANCELLED') {
      throw new BadRequestException('Cannot modify expenses of a completed or cancelled social');
    }

    // Check amount
    if (createExpenseDto.amount && parseFloat(createExpenseDto.amount) < 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    const parsedAmount = Math.round(parseFloat(createExpenseDto.amount));

    // Create expense
    const result = await this.prisma.socialExpense.create({
      data: {
        socialId,
        title: createExpenseDto.title,
        description: createExpenseDto.description,
        amount: parsedAmount,
        receiptUrl: createExpenseDto.receiptUrl,
        expenseDate: createExpenseDto.expenseDate ? new Date(createExpenseDto.expenseDate) : undefined,
        createdById: userId,
      }
    });

    // Update totalExpense on Social
    await this.updateSocialTotalExpense(socialId);

    const members = await this.prisma.socialParticipant.findMany({
      where: { socialId, status: { not: SocialParticipantStatus.CANCELLED } },
      select: { userId: true },
    });
    const userIds = members.map((member) => member.userId);
    const createTitle = 'New expense added';
    const createMessage = `A new expense "${result.title}" was added in social "${social.title}".`;
    try {
      await this.notificationService.sendInAppNotification(userIds, createTitle, createMessage);
    } catch (notifError) {
      this.logger.error(
        `Failed to send notification for created expense in social ${socialId}: ${
          notifError instanceof Error ? notifError.message : String(notifError)
        }`
      );
    }

    return {
      message: 'Expense created successfully',
      data: result
    }
  }

  /**
   * List all expenses within a social
   * For social participants
   * @param socialId 
   * @param userId 
   * @returns 
   */
  async getExpenses(socialId: string, userId: string, listExpenseQueryDto: ListExpenseQueryDto) {
    // Pagination and filtering
    const page = listExpenseQueryDto.page ?? 1;
    const limit = listExpenseQueryDto.limit ?? 10;
    const offset = (page - 1) * limit;

    // Check social and participant
    await this.checkSocialAndCreator(socialId, userId);

    // Build query conditions
    const where: Prisma.SocialExpenseWhereInput = { socialId };

    // Apply search filter
    if (listExpenseQueryDto.search) {
      where.OR = [
        { title: { contains: listExpenseQueryDto.search, mode: 'insensitive' } },
        { description: { contains: listExpenseQueryDto.search, mode: 'insensitive' } }
      ];
    }

    // Apply sorting
    const orderBy: any = {};
    if (listExpenseQueryDto.sortBy) {
      orderBy[listExpenseQueryDto.sortBy] = listExpenseQueryDto.order || 'desc';
    }

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

      // Otherwise, fetch all users who created expenses in this social
    } else {
      const expenses = await this.prisma.socialExpense.findMany({
        where,
        select: { createdById: true },
        distinct: ['createdById']
      });
      const userIds = expenses.map(e => e.createdById);
      const users = await this.userService.getManyUsersByIds(userIds);
      users.forEach(user => {
        userMap[user.id] = user;
      });
    }

    // Fetch expenses with pagination, filtering, and sorting
    const expenses = await this.prisma.socialExpense.findMany({
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
    const total = await this.prisma.socialExpense.count({
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

  /**
   * Get details expense by id
   * @param expenseId 
   * @param socialId
   * @param userId 
   * @returns
   */
  async getDetailsById(expenseId: string, socialId: string, userId: string) {
    // Check social and participant
    await this.checkSocialAndCreator(socialId, userId);

    // Get expense
    const expense = await this.prisma.socialExpense.findFirst({
      where: {
        id: expenseId,
        socialId
      },
    });

    // If expense not found, throw 404
    if (!expense) throw new NotFoundException('Expense not found');

    // Get user info
    const user = await this.userService.getUserById(expense.createdById);

    const data = {
      ...expense,
      createdBy: user ? {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      } : null,
    }

    return {
      message: 'Get expense details successfully',
      data: data
    };
  }

  /**
   * Update expense details
   * For social organizers only
   * @param expenseId 
   * @param socialId
   * @param userId 
   * @param updateExpenseDto
   */
  async updateExpense(expenseId: string, socialId: string, userId: string, updateExpenseDto: UpdateExpenseDto) {
    // Check social and organizer role
    const { social } = await this.checkSocialAndCreator(socialId, userId);

    if (social.status === 'COMPLETED' || social.status === 'CANCELLED') {
      throw new BadRequestException('Cannot modify expenses of a completed or cancelled social');
    }

    // Get expense
    const expense = await this.prisma.socialExpense.findFirst({
      where: {
        id: expenseId,
        socialId
      }
    });

    // If expense not found, throw 404
    if (!expense) throw new NotFoundException('Expense not found');

    // Check amount
    if (updateExpenseDto.amount && parseFloat(updateExpenseDto.amount) < 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    // Build update data object
    const data: Prisma.SocialExpenseUpdateInput = {};
    if (updateExpenseDto.title !== undefined) data.title = updateExpenseDto.title;
    if (updateExpenseDto.description !== undefined) data.description = updateExpenseDto.description;
    if (updateExpenseDto.amount !== undefined) {
      data.amount = Math.round(parseFloat(updateExpenseDto.amount));
    }
    if (updateExpenseDto.receiptUrl !== undefined) data.receiptUrl = updateExpenseDto.receiptUrl;
    if (updateExpenseDto.expenseDate !== undefined) data.expenseDate = new Date(updateExpenseDto.expenseDate);

    // Update expense
    const result = await this.prisma.socialExpense.update({
      where: { id: expenseId },
      data
    });

    // Update totalExpense on Social
    await this.updateSocialTotalExpense(socialId);

    // Send notification to participants about the update
    const participants = await this.prisma.socialParticipant.findMany({
      where: { socialId, status: { not: SocialParticipantStatus.CANCELLED } },
      select: { userId: true },
    });
    const userIds = participants.map((participant) => participant.userId);
    const expenseTitle = updateExpenseDto.title ?? expense.title;
    const updateTitle = 'Khoản chi mới vừa được cập nhật';
    const updateMessage = `Khoản chi "${expenseTitle}" vừa được cập nhật.`;
    try {
      await this.notificationService.sendInAppNotification(userIds, updateTitle, updateMessage);
    } catch (notifError) {
      this.logger.error(
        `Failed to send notification for updated expense in social ${socialId}: ${
          notifError instanceof Error ? notifError.message : String(notifError)
        }`
      );
    }

    return {
      message: 'Expense updated successfully',
      data: result,
    };
  }

  /**
   * Delete a expense
   * For social organizers only
   * @param expenseId
   * @param socialId
   * @param userId
   */
  async deleteExpense(expenseId: string, socialId: string, userId: string) {
    // Check social and organizer role
    const { social } = await this.checkSocialAndCreator(socialId, userId);

    if (social.status === 'COMPLETED' || social.status === 'CANCELLED') {
      throw new BadRequestException('Cannot modify expenses of a completed or cancelled social');
    }

    // Delete expense
    const res = await this.prisma.socialExpense.deleteMany({
      where: {
        id: expenseId,
        socialId
      },
    });

    if (res.count === 0) {
      throw new NotFoundException('Expense not found');
    }

    // Update totalExpense on Social
    await this.updateSocialTotalExpense(socialId);

    return {
      message: 'Expense deleted successfully'
    }
  }
}