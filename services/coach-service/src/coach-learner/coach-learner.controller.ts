import { Controller, Get, Param, ParseUUIDPipe, Query, Request, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CoachLearnerService } from './coach-learner.service';
import { ListCoachLearnersQueryDto } from './dto/list-coach-learners-query.dto';
import { RequireSubscription } from '../guards/subscription.guard';

const COACH_LEARNER_LIST_EXAMPLE = {
  learnerId: 'a0000010-a000-4000-8000-000000000010',
  learnerProfile: {
    id: 'a0000010-a000-4000-8000-000000000010',
    name: 'Learner One',
    email: 'learner1@example.com',
    role: 'USER',
    avatarUrl: 'https://cdn.picklehub.vn/avatars/learner1.jpg',
  },
  latestActivityAt: '2026-07-12T10:30:00.000Z',
  classEnrollmentCount: 1,
  activeClassEnrollmentCount: 1,
  cancelledClassEnrollmentCount: 0,
  classPaymentPendingReviewCount: 1,
  classPaymentSettledCount: 0,
  classPaymentRejectedCount: 0,
  privateBookingCount: 1,
  pendingBookingCount: 0,
  confirmedBookingCount: 1,
  completedBookingCount: 0,
  cancelledBookingCount: 0,
  rejectedBookingCount: 0,
  bookingPaymentPendingReviewCount: 1,
  bookingPaymentSettledCount: 0,
  bookingPaymentRejectedCount: 0,
};

const COACH_LEARNER_DASHBOARD_EXAMPLE = {
  totalLearners: 1,
  learnersWithPendingClassPayments: 1,
  learnersWithPendingBookingPayments: 1,
  learnersWithUpcomingSessions: 1,
  upcomingSessionTotal: 2,
  attentionLearners: [
    {
      learnerId: 'a0000010-a000-4000-8000-000000000010',
      learnerProfile: {
        id: 'a0000010-a000-4000-8000-000000000010',
        name: 'Learner One',
        email: 'learner1@example.com',
        role: 'USER',
        avatarUrl: 'https://cdn.picklehub.vn/avatars/learner1.jpg',
      },
      latestActivityAt: '2026-07-12T10:30:00.000Z',
      upcomingSessionCount: 2,
      classPaymentPendingReviewCount: 1,
      classPaymentRejectedCount: 0,
      bookingPaymentPendingReviewCount: 1,
      bookingPaymentRejectedCount: 0,
    },
  ],
  asOf: '2026-07-01T00:00:00.000Z',
};

const COACH_LEARNER_DETAIL_EXAMPLE = {
  learnerProfile: {
    id: 'a0000010-a000-4000-8000-000000000010',
    name: 'Learner One',
    email: 'learner1@example.com',
    role: 'USER',
    avatarUrl: 'https://cdn.picklehub.vn/avatars/learner1.jpg',
  },
  summary: {
    latestActivityAt: '2026-07-12T10:30:00.000Z',
    classEnrollmentCount: 1,
    activeClassEnrollmentCount: 1,
    cancelledClassEnrollmentCount: 0,
    classPaymentPendingReviewCount: 1,
    classPaymentSettledCount: 0,
    classPaymentRejectedCount: 0,
    privateBookingCount: 1,
    pendingBookingCount: 0,
    confirmedBookingCount: 1,
    completedBookingCount: 0,
    cancelledBookingCount: 0,
    rejectedBookingCount: 0,
    bookingPaymentPendingReviewCount: 1,
    bookingPaymentSettledCount: 0,
    bookingPaymentRejectedCount: 0,
  },
  upcomingSessions: [
    {
      type: 'class',
      id: 'e0000001-e000-4000-8000-000000000001',
      title: 'Pickleball Beginner Boot Camp',
      startsAt: '2026-07-19T09:00:00.000Z',
      status: 'ACTIVE',
      paymentStatus: null,
      classId: 'f0000001-f000-4000-8000-000000000001',
      classTitle: 'Pickleball Beginner Boot Camp',
    },
    {
      type: 'booking',
      id: 'a1000001-a100-4000-8000-000000000001',
      title: 'Private booking',
      startsAt: '2026-07-20T09:00:00.000Z',
      status: 'CONFIRMED',
      paymentStatus: 'PENDING_REVIEW',
      bookingId: 'a1000001-a100-4000-8000-000000000001',
    },
  ],
  classEnrollments: [
    {
      id: 'b0000001-b000-4000-8000-000000000001',
      classId: 'f0000001-f000-4000-8000-000000000001',
      learnerId: 'a0000010-a000-4000-8000-000000000010',
      status: 'ACTIVE',
      paymentStatus: 'PENDING_REVIEW',
      amountVnd: 1500000,
      paymentProofUrl: 'https://cdn.picklehub.vn/payment-proofs/txn-abc123.jpg',
      proofUploadedAt: '2026-07-06T08:30:00.000Z',
      settledAt: null,
      enrolledAt: '2026-07-05T10:00:00.000Z',
      cancelledAt: null,
      coachClass: {
        id: 'f0000001-f000-4000-8000-000000000001',
        title: 'Pickleball Beginner Boot Camp',
        level: 'Beginner',
        status: 'OPEN',
        locationDescription: 'Sân Pickleball 360, 123 Lê Văn Lương, Hà Nội',
        priceVnd: 1500000,
        coverImageUrl: 'https://cdn.picklehub.vn/classes/bootcamp-cover.jpg',
      },
    },
  ],
  privateBookings: [
    {
      id: 'a1000001-a100-4000-8000-000000000001',
      coachProfileId: 'c0000001-c000-4000-8000-000000000001',
      learnerId: 'a0000010-a000-4000-8000-000000000010',
      sessionAt: '2026-07-20T09:00:00.000Z',
      durationMinutes: 60,
      priceVnd: 300000,
      status: 'CONFIRMED',
      paymentStatus: 'PENDING_REVIEW',
      learnerNote: 'Tôi muốn cải thiện kỹ thuật serve và dinking.',
      coachNote: 'Xác nhận buổi tập. Vui lòng chuyển khoản và gửi minh chứng.',
      cancelReason: null,
      paymentProofUrl: 'https://cdn.picklehub.vn/payment-proofs/booking-txn-xyz789.jpg',
      proofUploadedAt: '2026-07-12T10:30:00.000Z',
      settledAt: null,
      completedAt: null,
      createdAt: '2026-07-10T08:00:00.000Z',
      updatedAt: '2026-07-10T08:00:00.000Z',
    },
  ],
};

@ApiTags('Coach Learners')
@Controller('api/coach/learners')
@RequireSubscription('COACH')
export class CoachLearnerController {
  constructor(private readonly coachLearnerService: CoachLearnerService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) List learners across my classes and bookings',
    description:
      'Returns one row per learner associated with the current coach through class enrollments or private bookings. This is the first coach-side learner-management view.\n\n' +
      'Use `kind=class` or `kind=booking` to narrow the source. Results are sorted by latest activity.',
  })
  @ApiQuery({ name: 'kind', required: false, enum: ['all', 'class', 'booking'] })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by learner name, email, or user ID.' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Paginated learner list for the coach.',
    schema: {
      example: {
        data: [COACH_LEARNER_LIST_EXAMPLE],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  list(@Request() req: any, @Query() query: ListCoachLearnersQueryDto) {
    return this.coachLearnerService.listCoachLearners(req.user.userId, query);
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Learner management dashboard summary',
    description:
      'Returns the coach-side learner management snapshot: total learners, payment alerts, and upcoming-session pressure points.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary for learner management.',
    schema: { example: COACH_LEARNER_DASHBOARD_EXAMPLE },
  })
  @HttpCode(HttpStatus.OK)
  dashboard(@Request() req: any) {
    return this.coachLearnerService.getCoachLearnerDashboard(req.user.userId);
  }

  @Get(':learnerId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Get one learner detail',
    description:
      'Returns the current coach\'s relationship with a specific learner, including class enrollments and private bookings.',
  })
  @ApiResponse({
    status: 200,
    description: 'Learner detail for this coach.',
    schema: { example: COACH_LEARNER_DETAIL_EXAMPLE },
  })
  @ApiResponse({ status: 404, description: 'Learner not found in your classes or bookings.' })
  @HttpCode(HttpStatus.OK)
  findOne(
    @Request() req: any,
    @Param('learnerId', ParseUUIDPipe) learnerId: string,
  ) {
    return this.coachLearnerService.findCoachLearner(req.user.userId, learnerId);
  }
}
