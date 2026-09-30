import { Controller, Get, Query, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CoachRevenueService } from './coach-revenue.service';
import { CoachRevenueRangeQueryDto } from './dto/coach-revenue-range-query.dto';
import { CoachRevenueSummaryQueryDto } from './dto/coach-revenue-summary-query.dto';
import { RequireSubscription } from '../guards/subscription.guard';

const REVENUE_SUMMARY_EXAMPLE = {
  year: 2026,
  period: 'month',
  totals: {
    classRevenueVnd: 4500000,
    bookingRevenueVnd: 1200000,
    totalRevenueVnd: 5700000,
    classSettlementCount: 3,
    bookingSettlementCount: 4,
    totalSettlementCount: 7,
  },
  buckets: [
    {
      key: '2026-01',
      label: 'Jan 2026',
      classRevenueVnd: 0,
      bookingRevenueVnd: 0,
      totalRevenueVnd: 0,
      classSettlementCount: 0,
      bookingSettlementCount: 0,
      totalSettlementCount: 0,
    },
    {
      key: '2026-07',
      label: 'Jul 2026',
      classRevenueVnd: 1500000,
      bookingRevenueVnd: 300000,
      totalRevenueVnd: 1800000,
      classSettlementCount: 1,
      bookingSettlementCount: 1,
      totalSettlementCount: 2,
    },
  ],
};

const REVENUE_CLASS_EXAMPLE = {
  data: [
    {
      classId: 'f0000001-f000-4000-8000-000000000001',
      title: 'Pickleball Beginner Boot Camp',
      status: 'OPEN',
      level: 'Beginner',
      locationDescription: 'Sân Pickleball 360, 123 Lê Văn Lương, Hà Nội',
      coverImageUrl: 'https://cdn.picklehub.vn/classes/bootcamp-cover.jpg',
      enrolledLearnerCount: 3,
      settledEnrollmentCount: 3,
      settledRevenueVnd: 4500000,
      firstSettledAt: '2026-07-08T00:00:00.000Z',
      lastSettledAt: '2026-07-18T00:00:00.000Z',
    },
  ],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
  totals: {
    settledEnrollmentCount: 3,
    settledRevenueVnd: 4500000,
  },
};

const REVENUE_BOOKING_EXAMPLE = {
  data: [
    {
      bookingId: 'a1000001-a100-4000-8000-000000000001',
      coachProfileId: 'c0000001-c000-4000-8000-000000000001',
      learnerId: 'a0000010-a000-4000-8000-000000000010',
      learnerProfile: {
        id: 'a0000010-a000-4000-8000-000000000010',
        name: 'Picklehub Seed User',
        email: 'seed-user@picklehub.com',
        role: 'USER',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      },
      sessionAt: '2026-07-20T09:00:00.000Z',
      durationMinutes: 60,
      status: 'CONFIRMED',
      paymentStatus: 'SETTLED',
      priceVnd: 300000,
      settledAt: '2026-07-13T09:00:00.000Z',
      coachNote: 'Xác nhận buổi tập. Vui lòng chuyển khoản và gửi minh chứng.',
      cancelReason: null,
    },
  ],
  pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
  totals: {
    settledBookingCount: 1,
    settledRevenueVnd: 300000,
  },
};

@ApiTags('Coach Revenue')
@Controller('api/coach/revenue')
@RequireSubscription('COACH')
export class CoachRevenueController {
  constructor(private readonly revenueService: CoachRevenueService) {}

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Revenue summary by period',
    description:
      'Returns revenue from SETTLED class enrollments and SETTLED private bookings. Use the period query to group by month, quarter, or year. Revenue is derived strictly from settled payments, not pending or rejected proofs.',
  })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  @ApiQuery({ name: 'period', required: false, enum: ['month', 'quarter', 'year'], example: 'month' })
  @ApiResponse({
    status: 200,
    description: 'Revenue summary for the selected year and period.',
    schema: { example: REVENUE_SUMMARY_EXAMPLE },
  })
  @HttpCode(HttpStatus.OK)
  getSummary(@Request() req: any, @Query() query: CoachRevenueSummaryQueryDto) {
    return this.revenueService.getSummary(req.user.userId, query);
  }

  @Get('classes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Revenue by class',
    description:
      'Returns revenue grouped by class. Each row shows only settled enrollments, settled amount, and settlement timestamps.',
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO 8601 start date for settledAt filtering.' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO 8601 end date for settledAt filtering.' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Paginated revenue breakdown by class.',
    schema: { example: REVENUE_CLASS_EXAMPLE },
  })
  @HttpCode(HttpStatus.OK)
  listClassRevenue(@Request() req: any, @Query() query: CoachRevenueRangeQueryDto) {
    return this.revenueService.listClassRevenue(req.user.userId, query);
  }

  @Get('bookings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Revenue by booking',
    description:
      'Returns revenue for each settled private booking. Each row includes the snapped booking price and settlement timestamp.',
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO 8601 start date for settledAt filtering.' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO 8601 end date for settledAt filtering.' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Paginated revenue breakdown by booking.',
    schema: { example: REVENUE_BOOKING_EXAMPLE },
  })
  @HttpCode(HttpStatus.OK)
  listBookingRevenue(@Request() req: any, @Query() query: CoachRevenueRangeQueryDto) {
    return this.revenueService.listBookingRevenue(req.user.userId, query);
  }
}
