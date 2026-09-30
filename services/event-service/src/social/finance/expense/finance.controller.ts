import { Controller, Post, Body, UseGuards, Request, Param, UnauthorizedException, Query, Get } from "@nestjs/common";
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse,
  ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse, ApiForbiddenResponse,
  ApiInternalServerErrorResponse, ApiBody
} from "@nestjs/swagger";
import { FinanceService } from "./finance.service";
import { JwtAuthGuard } from "../../guards/jwt-auth.guard";
import { FinanceSummaryQueryDto } from "./dto/finance-summary-query.dto";
import { ListCreditBalanceQueryDto } from "./dto/list-credit-balance.dto";

import { PricingCalculatorDto } from "./dto/pricing-calculator.dto";
import { ApplyPricingDto } from "./dto/apply-pricing.dto";

type AuthRequest = Request & {
  user?: {
    userId: string;
    userName?: string;
    email?: string;
    roles?: string[];
  };
};

@ApiTags('Finance')
@Controller('api/socials/:socialId/finances')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) { }

  // #region GET /socials/:socialId/finances/summary

  @Get('summary')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get social finance summary',
    description: 'Get a summary of financial status of the social, including total collected payments, total expenses, and net balance.',
  })
  @ApiParam({ name: 'socialId', description: 'Social id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Get finance summary successfully',
    schema: {
      properties: {
        message: { type: 'string', example: 'Get finance summary successfully' },
        data: {
          type: 'object',
          properties: {
            totalExpense: {
              type: 'number',
              example: 620000,
              description:
                'Total costs incurred by the social = court booking cost (totalBookingCost) + all manual expenses (e.g. balls, shuttles). ' +
                'This is the break-even target the host needs to cover.',
            },
            participants: {
              type: 'object',
              description: 'Snapshot of participant slot usage.',
              properties: {
                joinedCount: { type: 'number', example: 4, description: 'Number of non-cancelled participants currently in the social.' },
              },
            },
            paidMembersCount: {
              type: 'number',
              example: 3,
              description: 'Number of active participants whose amountPaid >= totalFee (fully settled). Includes the host (always PAID with fee=0).',
            },
            collectedAmount: {
              type: 'number',
              example: 600000,
              description: 'Total cash actually received from all participants (sum of amountPaid). Includes any overpayments and payments from CANCELLED members.',
            },
            outstandingAmount: {
              type: 'number',
              example: 150000,
              description: 'Total remaining balance owed by active participants who have not yet paid in full (sum of totalFee - amountPaid for underpaid active members).',
            },
            collectionProgress: {
              type: 'number',
              example: 100,
              description:
                'Percentage of total expected revenue already collected: collectedAmount / totalExpectedRevenue × 100. ' +
                'Can exceed 100 if overpayments exist.',
            },
            totalExpectedRevenue: {
              type: 'number',
              example: 600000,
              description:
                'Total fees that active participants are expected to pay (sum of totalFee for all active members). ' +
                'Excludes CANCELLED members.',
            },
            totalRefundAmount: {
              type: 'number',
              example: 150000,
              description:
                'Total credit surplus across all members who have overpaid or cancelled (sum of amountPaid - totalFee for members where amountPaid > totalFee). ' +
                'Represents money the host should refund.',
            },
            estimatedProfit: {
              type: 'number',
              example: -20000,
              description:
                'Estimated net balance = totalExpectedRevenue - totalExpense. ' +
                'Positive = surplus (host covers more than costs). Negative = deficit (costs exceed what active participants are charged).',
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid social id' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Social not found.' })
  @ApiForbiddenResponse({ description: 'Only social members can view finance details.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  @UseGuards(JwtAuthGuard)
  async getFinanceSummary(
    @Request() req: AuthRequest,
    @Param('socialId') socialId: string,
    @Query() financeSummaryQueryDto: FinanceSummaryQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.summarySocialFinance(socialId, userId, financeSummaryQueryDto);
  }

  // #endregion

  // #region GET /socials/:socialId/finances/credit-balances

  @Get('credit-balances')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List members with credit balance',
    description: 'List social members (both active and CANCELLED) that have a positive credit balance with pagination and simple filters.',
  })
  @ApiParam({ name: 'socialId', description: 'Social id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Get credit balance list successfully',
    schema: {
      example: {
        message: 'Get credit balance list successfully',
        data: [
          {
            userId: '123e4567-e89b-12d3-a456-426614174000',
            creditBalance: 150000,
            status: 'CANCELLED',
            user: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              name: 'Alex Nguyen',
              email: 'alex@example.com',
              avatarUrl: 'https://example.com/avatar/alex.png',
            },
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid social id or invalid query parameters.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Social not found.' })
  @ApiForbiddenResponse({ description: 'Only social members can view credit balances.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  @UseGuards(JwtAuthGuard)
  async getCreditBalances(
    @Request() req: AuthRequest,
    @Param('socialId') socialId: string,
    @Query() listCreditBalanceQueryDto: ListCreditBalanceQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.listMembersWithCreditBalance(socialId, userId, listCreditBalanceQueryDto);
  }

  // #endregion

  // #region GET /socials/:socialId/finances/court-bookings

  @Get('court-bookings')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List court booking expenses',
    description: 'Returns a list of court booking expenses for all play sessions of a social. Each session includes its booking cost fetched from the court service.',
  })
  @ApiParam({ name: 'socialId', description: 'Social id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Get court booking expenses successfully',
    schema: {
      example: {
        message: 'Get court booking expenses successfully',
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174001',
            title: 'Morning Session',
            startTime: '2026-03-30T09:00:00.000Z',
            endTime: '2026-03-30T11:00:00.000Z',
            location: 'Sân Pickleball ABC, 123 Nguyễn Văn Linh',
            bookingIds: ['booking-id-1', 'booking-id-2'],
            numberOfCourts: 2,
            courtNames: 'Court A, Court B',
            sessionFee: 500000,
            bookingCost: 450000,
          },
          {
            id: '123e4567-e89b-12d3-a456-426614174002',
            title: 'Afternoon Session',
            startTime: '2026-03-30T14:00:00.000Z',
            endTime: '2026-03-30T16:00:00.000Z',
            location: 'Sân Pickleball ABC, 123 Nguyễn Văn Linh',
            bookingIds: ['booking-id-3'],
            numberOfCourts: 1,
            courtNames: 'Court A',
            sessionFee: 600000,
            bookingCost: 500000,
          },
        ],
        totalBookingCost: 950000,
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid social id.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Social not found.' })
  @ApiForbiddenResponse({ description: 'Only social members can view court booking expenses.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  @UseGuards(JwtAuthGuard)
  async getCourtBookingExpenses(
    @Request() req: AuthRequest,
    @Param('socialId') socialId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.listCourtBookingExpenses(socialId, userId);
  }

  // #endregion

  // #region POST /socials/:socialId/finances/pricing-calculator

  @Post('pricing-calculator')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Calculate suggested pricing with interactive overrides',
    description:
      'Interactive pricing calculator that suggests package and per-session prices based on break-even analysis, ' +
      'allowing the host to override specific session fees or package prices to see how it affects other calculations.',
  })
  @ApiParam({ name: 'socialId', description: 'Social id (UUID).' })
  @ApiBody({ type: PricingCalculatorDto, description: 'Calculation options and optional price overrides.' })
  @ApiResponse({
    status: 200,
    description: 'Get pricing suggestions with overrides successfully',
    schema: {
      example: {
        message: 'Get pricing suggestions successfully',
        data: {
          inputs: {
            targetPlayers: 8,
            suggestedPackagePriceOverride: 250000,
            sessionOverrides: [
              {
                sessionId: '123e4567-e89b-12d3-a456-426614174001',
                suggestedPrice: 80000
              }
            ]
          },
          summary: {
            totalBookingCost: 1550000,
            totalManualExpenses: 550000,
            totalExpense: 2100000,
            totalSessionsCount: 3,
            packageBreakEven: 262500,
            suggestedPackagePrice: 250000,
            sumSessionSuggestedPrices: 290000,
            isWarning: true,
            warningPackageBelowBreakEven: true,
            warningPackageNotCheaperThanSessions: false,
            simulatedPackageRevenue: 2000000,
            simulatedPackageProfit: -100000,
            simulatedSessionsRevenue: 2320000,
            simulatedSessionsProfit: 220000
          },
          sessions: [
            {
              id: '123e4567-e89b-12d3-a456-426614174001',
              title: 'Phiên 1',
              sessionFee: 500000,
              bookingCost: 450000,
              allocatedExpense: 183333,
              breakEven: 79167,
              suggestedPrice: 80000
            },
            {
              id: '123e4567-e89b-12d3-a456-426614174002',
              title: 'Phiên 2',
              sessionFee: 600000,
              bookingCost: 500000,
              allocatedExpense: 183333,
              breakEven: 85417,
              suggestedPrice: 100000
            },
            {
              id: '123e4567-e89b-12d3-a456-426614174003',
              title: 'Phiên 3',
              sessionFee: 700000,
              bookingCost: 600000,
              allocatedExpense: 183333,
              breakEven: 97917,
              suggestedPrice: 110000
            }
          ]
        }
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Invalid parameters or no active play sessions.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Social not found.' })
  @ApiForbiddenResponse({ description: 'Only social members can use the pricing calculator.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  @UseGuards(JwtAuthGuard)
  async calculatePricingSuggestions(
    @Request() req: AuthRequest,
    @Param('socialId') socialId: string,
    @Body() pricingCalculatorDto: PricingCalculatorDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.calculatePricingSuggestions(socialId, userId, pricingCalculatorDto);
  }

  // #endregion

  // #region POST /socials/:socialId/finances/apply-pricing

  @Post('apply-pricing')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Apply pricing to social',
    description:
      'Apply pricing to social and recalculate fees for participants' +
      'Only works on DRAFT socials.',
  })
  @ApiParam({ name: 'socialId', description: 'Social id (UUID).' })
  @ApiBody({ type: ApplyPricingDto, description: 'Package fee and session fees to apply.' })
  @ApiResponse({
    status: 201,
    description: 'Pricing applied successfully',
    schema: {
      example: {
        message: 'Pricing applied successfully',
        data: {
          id: '3a0c173f-e79c-49a8-b67c-c4260db7ff89',
          title: 'Morning Pickleball Session',
          packageFee: 290000,
          status: 'DRAFT',
          playSessions: [
            {
              id: '123e4567-e89b-12d3-a456-426614174001',
              title: 'Session 1',
              sessionFee: 90000,
            },
            {
              id: '123e4567-e89b-12d3-a456-426614174002',
              title: 'Session 2',
              sessionFee: 100000,
            },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Social is already published, or invalid session IDs.' })
  @ApiUnauthorizedResponse({ description: 'Missing/invalid JWT or user identity.' })
  @ApiNotFoundResponse({ description: 'Social not found.' })
  @ApiForbiddenResponse({ description: 'Only social creator can apply pricing.' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
  @UseGuards(JwtAuthGuard)
  async applyPricing(
    @Request() req: AuthRequest,
    @Param('socialId') socialId: string,
    @Body() applyPricingDto: ApplyPricingDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }
    return this.financeService.applyPricing(socialId, userId, applyPricingDto);
  }

  // #endregion
}
