import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../prisma.service";
import { SocialErrors } from "../../errors/social.errors";
import { Prisma, PlaySessionStatus, SocialParticipantStatus, SocialPaymentStatus, SocialStatus } from "@prisma/client";
import { FinanceSummaryQueryDto } from "./dto/finance-summary-query.dto";
import { ListCreditBalanceQueryDto } from "./dto/list-credit-balance.dto";

import { PricingCalculatorDto } from "./dto/pricing-calculator.dto";
import { ApplyPricingDto } from "./dto/apply-pricing.dto";
import { UserService } from "../../../user/user.service";
import { SocialParticipantService } from "../../participant/social-participant.service";

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  private readonly centerAxios: AxiosInstance;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
    private readonly socialParticipantService: SocialParticipantService,
  ) {
    const CenterServiceUrl = this.configService.get<string>('SPORT_CENTER_SERVICE_URL');
    const centerToken = this.configService.get<string>('SERVICE_INTERNAL_TOKEN');

    this.centerAxios = axios.create({
      baseURL: CenterServiceUrl,
      headers: {
        'X-Internal-Service-Token': centerToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  /**
   * Summarizes the financial status of a social
   * including total funds, total expenses, and net balance
   */
  async summarySocialFinance(socialId: string, userId: string, filters?: FinanceSummaryQueryDto) {
    // Validate social
    const social = await this.prisma.social.findUnique({ where: { id: socialId } });
    if (!social) throw new NotFoundException(SocialErrors.SOCIAL_NOT_FOUND.message);

    if (social.creatorId !== userId) {
      throw new ForbiddenException(SocialErrors.SOCIAL_NOT_OWNER.message);
    }

    const dateFilter = this.buildDateFilter(filters?.fromDate, filters?.toDate);

    const expenseWhere: Prisma.SocialExpenseWhereInput = {
      socialId,
      ...(dateFilter ? { expenseDate: dateFilter } : {}),
    };

    // Fetch participants (including cancelled ones to track credit/payments)
    const participants = await this.prisma.socialParticipant.findMany({
      where: {
        socialId,
        ...(dateFilter ? { joinedAt: dateFilter } : {}),
      },
      select: {
        totalFee: true,
        amountPaid: true,
        amountRefunded: true,
        paymentStatus: true,
        status: true,
      },
    });

    const [expenseAggregate, expenseCount, pendingPaymentsAggregate] = await Promise.all([
      this.prisma.socialExpense.aggregate({
        where: expenseWhere,
        _sum: {
          amount: true,
        },
      }),
      this.prisma.socialExpense.count({ where: expenseWhere }),
      this.prisma.socialPayment.aggregate({
        where: {
          status: SocialPaymentStatus.PENDING_REVIEW,
          socialParticipant: {
            socialId,
          },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    // calculate totals
    const totalExpense = (social.totalBookingCost ?? 0) + (expenseAggregate._sum.amount ?? 0);
    const paidMembersCount = participants.filter((p) => p.status !== SocialParticipantStatus.CANCELLED && (p.amountPaid ?? 0) >= (p.totalFee ?? 0)).length;
    const collectedAmount = participants.reduce((sum, p) => sum + (p.amountPaid ?? 0), 0);
    const outstandingAmount = participants
      .filter((p) => p.status !== SocialParticipantStatus.CANCELLED && (p.totalFee ?? 0) > (p.amountPaid ?? 0))
      .reduce((sum, p) => sum + ((p.totalFee ?? 0) - (p.amountPaid ?? 0)), 0);
    const totalExpectedRevenue = participants
      .filter((p) => p.status !== SocialParticipantStatus.CANCELLED)
      .reduce((sum, p) => sum + (p.totalFee ?? 0), 0);
    // collectionProgress: % of expected revenue already collected (capped — shows payments vs amount owed)
    const collectionProgress = totalExpectedRevenue > 0 ? (collectedAmount / totalExpectedRevenue) * 100 : 0;
    const totalRefundAmount = participants.reduce((sum, p) => {
      const netPaid = (p.amountPaid ?? 0) - (p.amountRefunded ?? 0);
      const fee = p.totalFee ?? 0;
      return sum + Math.max(0, netPaid - fee);
    }, 0);
    const estimatedProfit = totalExpectedRevenue - totalExpense;

    return {
      message: 'Get finance summary successfully',
      data: {
        totalExpense,
        participants: {
          joinedCount: social.joinedCount,
        },
        paidMembersCount,
        collectedAmount,
        outstandingAmount,
        collectionProgress,
        totalExpectedRevenue,
        totalRefundAmount,
        estimatedProfit,
      },
    };
  }

  /**
   * Lists social participants with positive credit balance
   * (where amountPaid > totalFee)
   */
  async listMembersWithCreditBalance(
    socialId: string,
    userId: string,
    query: ListCreditBalanceQueryDto,
  ) {
    // Pagination
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    // Check social and participant
    const social = await this.prisma.social.findUnique({ where: { id: socialId } });
    if (!social) throw new NotFoundException(SocialErrors.SOCIAL_NOT_FOUND.message);

    if (social.creatorId !== userId) {
      throw new ForbiddenException(SocialErrors.SOCIAL_NOT_OWNER.message);
    }

    // Fetch participants (including cancelled ones to track credit/payments)
    const where: Prisma.SocialParticipantWhereInput = {
      socialId,
    };

    if (query.userId) {
      where.userId = query.userId;
    }

    const participants = await this.prisma.socialParticipant.findMany({
      where,
      select: {
        userId: true,
        amountPaid: true,
        amountRefunded: true,
        totalFee: true,
        status: true,
      },
    });

    const minCredit = query.minCredit ?? 0;

    // Map and filter credit balance
    const mapped = participants
      .map((p) => {
        const creditBalance = Math.max(0, (p.amountPaid - p.amountRefunded) - p.totalFee);
        return {
          userId: p.userId,
          creditBalance,
          status: p.status,
        };
      })
      .filter((p) => p.creditBalance > minCredit);

    // Apply pagination
    const total = mapped.length;
    const paginated = mapped.slice(offset, offset + limit);

    // Get user info for each member
    const memberUserIds = paginated.map((member) => member.userId);
    const users = memberUserIds.length > 0
      ? await this.userService.getManyUsersByIds(memberUserIds)
      : [];
    const userMap = new Map(users.map((user) => [user.id, user]));

    // Map user info to response
    const data = paginated.map((member) => ({
      userId: member.userId,
      creditBalance: member.creditBalance,
      status: member.status,
      user: userMap.get(member.userId) || null,
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
  /**
   * Lists court booking expenses for all play sessions of a social.
   * Each session includes its booking cost fetched from the center service.
   */
  async listCourtBookingExpenses(socialId: string, userId: string) {
    const social = await this.prisma.social.findUnique({ where: { id: socialId } });
    if (!social) throw new NotFoundException(SocialErrors.SOCIAL_NOT_FOUND.message);

    if (social.creatorId !== userId) {
      throw new ForbiddenException(SocialErrors.SOCIAL_NOT_OWNER.message);
    }

    const sessions = await this.prisma.playSession.findMany({
      where: { socialId, status: { not: PlaySessionStatus.CANCELLED } },
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        title: true,
        startTime: true,
        endTime: true,
        location: true,
        bookingIds: true,
        numberOfCourts: true,
        courtNames: true,
        sessionFee: true,
      },
    });

    // Collect all booking IDs across sessions
    const allBookingIds = Array.from(
      new Set(sessions.flatMap(s => s.bookingIds || [])),
    ).filter(Boolean);

    // Batch-fetch booking info from center service
    let bookingInfoMap = new Map<string, number>();
    if (allBookingIds.length > 0) {
      try {
        const response = await this.centerAxios.post('/api/bookings/batch', {
          bookingIds: allBookingIds,
        });
        const bookingInfos = response.data.bookingInfos;
        if (Array.isArray(bookingInfos)) {
          for (const info of bookingInfos) {
            if (info?.id) {
              bookingInfoMap.set(info.id, Number(info.totalPrice ?? 0));
            }
          }
        }
      } catch (err) {
        this.logger.error(
          `Failed to fetch booking batch for social ${socialId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const data = sessions.map(session => {
      const bookingCost = (session.bookingIds || []).reduce(
        (sum, id) => sum + (bookingInfoMap.get(id) ?? 0),
        0,
      );
      return {
        id: session.id,
        title: session.title,
        startTime: session.startTime,
        endTime: session.endTime,
        location: session.location,
        bookingIds: session.bookingIds,
        numberOfCourts: session.numberOfCourts,
        courtNames: session.courtNames,
        sessionFee: session.sessionFee,
        bookingCost,
      };
    });

    const totalBookingCost = data.reduce((sum, s) => sum + s.bookingCost, 0);

    return {
      message: 'Get court booking expenses successfully',
      data,
      totalBookingCost,
    };
  }

  /**
   * Calculates suggested pricing for package and individual sessions
   * based on break-even analysis with buffer and rounding.
   */
  async calculatePricingSuggestions(
    socialId: string,
    userId: string,
    query: PricingCalculatorDto,
  ) {
    const social = await this.prisma.social.findUnique({ where: { id: socialId } });
    if (!social) throw new NotFoundException(SocialErrors.SOCIAL_NOT_FOUND.message);

    if (social.creatorId !== userId) {
      throw new ForbiddenException(SocialErrors.SOCIAL_NOT_OWNER.message);
    }

    const targetPlayers = query.targetPlayers;
    const ROUND_TO = 10000;

    // System-internal buffer strategy: always PERCENTAGE 10%
    const BUFFER_PERCENTAGE = 10;

    // 1. Fetch total manual expenses
    const expenseAggregate = await this.prisma.socialExpense.aggregate({
      where: { socialId },
      _sum: { amount: true },
    });
    const totalManualExpenses = expenseAggregate._sum.amount ?? 0;
    const totalBookingCost = social.totalBookingCost ?? 0;

    // 2. Total Expense
    const totalExpense = totalBookingCost + totalManualExpenses;

    // 3. Package Break-even
    const packageBreakEven = totalExpense / targetPlayers;

    // 4. Per-session break-even: fetch sessions and their booking costs
    const sessions = await this.prisma.playSession.findMany({
      where: { socialId, status: { not: PlaySessionStatus.CANCELLED } },
      orderBy: { startTime: 'asc' },
      select: {
        id: true,
        title: true,
        bookingIds: true,
        sessionFee: true,
      },
    });

    const totalSessionsCount = sessions.length;
    if (totalSessionsCount === 0) {
      throw new BadRequestException('No active play sessions found for this social');
    }

    // Batch fetch all booking prices
    const allBookingIds = Array.from(
      new Set(sessions.flatMap(s => s.bookingIds || [])),
    ).filter(Boolean);

    let bookingInfoMap = new Map<string, number>();
    if (allBookingIds.length > 0) {
      try {
        const response = await this.centerAxios.post('/api/bookings/batch', {
          bookingIds: allBookingIds,
        });
        const bookingInfos = response.data.bookingInfos;
        if (Array.isArray(bookingInfos)) {
          for (const info of bookingInfos) {
            if (info?.id) {
              bookingInfoMap.set(info.id, Number(info.totalPrice ?? 0));
            }
          }
        }
      } catch (err) {
        this.logger.error(
          `Failed to fetch booking batch for pricing calculator: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const allocatedExpense = totalManualExpenses / totalSessionsCount;

    const sessionDetails = sessions.map(session => {
      const sessionBookingCost = (session.bookingIds || []).reduce(
        (sum, id) => sum + (bookingInfoMap.get(id) ?? 0),
        0,
      );
      const breakEven = (sessionBookingCost + allocatedExpense) / targetPlayers;
      const bufferedPrice = breakEven * (1 + BUFFER_PERCENTAGE / 100);
      let suggestedPrice = Math.ceil(bufferedPrice / ROUND_TO) * ROUND_TO;

      // Apply session override if present
      const override = query.sessionOverrides?.find(o => o.sessionId === session.id);
      if (override && override.suggestedPrice !== undefined) {
        suggestedPrice = override.suggestedPrice;
      }

      return {
        id: session.id,
        title: session.title,
        sessionFee: session.sessionFee,
        bookingCost: sessionBookingCost,
        allocatedExpense: Math.round(allocatedExpense),
        breakEven: Math.round(breakEven),
        suggestedPrice,
      };
    });

    // 5. Package suggested price and overrides
    const sumSessionSuggestedPrices = sessionDetails.reduce(
      (sum, s) => sum + s.suggestedPrice,
      0,
    );

    let suggestedPackagePrice = 0;
    let isWarning = false;
    let warningPackageBelowBreakEven = false;
    let warningPackageNotCheaperThanSessions = false;

    if (query.suggestedPackagePrice !== undefined) {
      suggestedPackagePrice = query.suggestedPackagePrice;
      if (suggestedPackagePrice < packageBreakEven) {
        warningPackageBelowBreakEven = true;
      }
      if (suggestedPackagePrice >= sumSessionSuggestedPrices) {
        warningPackageNotCheaperThanSessions = true;
      }
      isWarning = warningPackageBelowBreakEven || warningPackageNotCheaperThanSessions;
    } else {
      const packageBufferedPrice = packageBreakEven * (1 + BUFFER_PERCENTAGE / 100);
      suggestedPackagePrice = Math.ceil(packageBufferedPrice / ROUND_TO) * ROUND_TO;

      // Promotion Rule: package must be cheaper than buying all sessions individually
      if (suggestedPackagePrice >= sumSessionSuggestedPrices) {
        suggestedPackagePrice = sumSessionSuggestedPrices - ROUND_TO;
        if (suggestedPackagePrice < packageBreakEven) {
          warningPackageBelowBreakEven = true;
          isWarning = true;
        }
      }
    }

    // 6. Simulated Outcomes
    const simulatedPackageRevenue = suggestedPackagePrice * targetPlayers;
    const simulatedPackageProfit = simulatedPackageRevenue - totalExpense;
    const simulatedSessionsRevenue = sumSessionSuggestedPrices * targetPlayers;
    const simulatedSessionsProfit = simulatedSessionsRevenue - totalExpense;

    return {
      message: 'Get pricing suggestions successfully',
      data: {
        inputs: {
          targetPlayers,
          suggestedPackagePriceOverride: query.suggestedPackagePrice,
          sessionOverrides: query.sessionOverrides,
        },
        summary: {
          totalBookingCost,
          totalManualExpenses,
          totalExpense,
          totalSessionsCount,
          packageBreakEven: Math.round(packageBreakEven),
          suggestedPackagePrice,
          sumSessionSuggestedPrices,
          isWarning,
          warningPackageBelowBreakEven,
          warningPackageNotCheaperThanSessions,
          simulatedPackageRevenue,
          simulatedPackageProfit,
          simulatedSessionsRevenue,
          simulatedSessionsProfit,
        },
        sessions: sessionDetails,
      },
    };
  }

  /**
   * Applies pricing (packageFee + per-session fees) to a social
   * in a single atomic transaction, then recalculates participant fees.
   */
  async applyPricing(socialId: string, userId: string, dto: ApplyPricingDto) {
    const social = await this.prisma.social.findUnique({ where: { id: socialId } });
    if (!social) throw new NotFoundException(SocialErrors.SOCIAL_NOT_FOUND.message);

    if (social.creatorId !== userId) {
      throw new ForbiddenException(SocialErrors.SOCIAL_NOT_OWNER.message);
    }

    if (social.status === SocialStatus.CANCELLED || social.status === SocialStatus.COMPLETED) {
      throw new BadRequestException('Cannot update pricing for this social');
    }

    if (social.status === SocialStatus.PUBLISHED) {
      throw new BadRequestException('Cannot update pricing when social is already published');
    }

    // Validate all session IDs belong to this social
    const sessions = await this.prisma.playSession.findMany({
      where: { socialId, status: { not: PlaySessionStatus.CANCELLED } },
      select: { id: true },
    });
    const validSessionIds = new Set(sessions.map(s => s.id));

    for (const sf of dto.sessionFees) {
      if (!validSessionIds.has(sf.sessionId)) {
        throw new BadRequestException(`Session ${sf.sessionId} not found in this social`);
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update packageFee on social
      await tx.social.update({
        where: { id: socialId },
        data: { packageFee: dto.packageFee },
      });

      // 2. Update each session fee
      for (const sf of dto.sessionFees) {
        await tx.playSession.update({
          where: { id: sf.sessionId },
          data: { sessionFee: sf.sessionFee },
        });
      }

      // 3. Recalculate totalFee for all active participants
      const participants = await tx.socialParticipant.findMany({
        where: { socialId, status: { not: SocialParticipantStatus.CANCELLED } },
        select: { id: true },
      });

      for (const part of participants) {
        await this.socialParticipantService.recalculateParticipantTotalFee(tx, part.id);
      }

      // Return updated social with sessions
      return tx.social.findUnique({
        where: { id: socialId },
        include: { playSessions: { orderBy: { startTime: 'asc' } } },
      });
    });

    return {
      message: 'Pricing applied successfully',
      data: result,
    };
  }

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
}