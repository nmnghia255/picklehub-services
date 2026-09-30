import { Controller, Get, HttpCode, HttpStatus, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { LearningScheduleService } from './learning-schedule.service';
import { ListLearningScheduleQueryDto } from './dto/list-learning-schedule-query.dto';

const LEARNING_SCHEDULE_EXAMPLE = {
  data: [
    {
      id: 'e0000001-e000-4000-8000-000000000001',
      kind: 'class',
      title: 'Pickleball Beginner Boot Camp',
      startsAt: '2026-07-19T09:00:00.000Z',
      endsAt: '2026-07-19T10:30:00.000Z',
      durationMinutes: 90,
      status: 'UPCOMING',
      sourceStatus: 'OPEN',
      coachProfile: {
        id: 'c0000001-c000-4000-8000-000000000001',
        displayName: 'Nguyễn Văn Coach',
        avatarUrl: 'https://cdn.picklehub.vn/avatars/coach1.jpg',
        verificationStatus: 'VERIFIED',
        locationCity: 'Hà Nội',
      },
      // Court-linked: enriched from sport-center-service at read-time
      locationDescription: 'Sân A, PickleHub Center Mỹ Đình, 365 Lê Văn Lương, Hà Nội',
      courtId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      topic: 'Luyện tập kỹ thuật serve và return',
      note: 'Mang vợt riêng. Sân số 3.',
      paymentStatus: null,
      priceVnd: null,
      coverImageUrl: 'https://cdn.picklehub.vn/classes/bootcamp-cover.jpg',
      actions: ['VIEW_CLASS', 'VIEW_COACH'],
      classId: 'f0000001-f000-4000-8000-000000000001',
      bookingId: null,
    },
    {
      id: 'a1000001-a100-4000-8000-000000000001',
      kind: 'booking',
      title: 'Private session with Nguyễn Văn Coach',
      startsAt: '2026-07-20T09:00:00.000Z',
      endsAt: '2026-07-20T10:00:00.000Z',
      durationMinutes: 60,
      status: 'UPCOMING',
      sourceStatus: 'CONFIRMED',
      coachProfile: {
        id: 'c0000001-c000-4000-8000-000000000001',
        displayName: 'Nguyễn Văn Coach',
        avatarUrl: 'https://cdn.picklehub.vn/avatars/coach1.jpg',
        verificationStatus: 'VERIFIED',
        locationCity: 'Hà Nội',
      },
      // No court linked — falls back to coach's free-text location
      locationDescription: 'Sân Pickleball Mỹ Đình, Số 5 Lê Đức Thọ, Hà Nội',
      courtId: null,
      topic: null,
      note: 'Xác nhận buổi tập. Vui lòng chuyển khoản và gửi minh chứng.',
      paymentStatus: 'PENDING_PROOF',
      priceVnd: 300000,
      coverImageUrl: null,
      actions: ['VIEW_BOOKING', 'UPLOAD_PAYMENT_PROOF'],
      classId: null,
      bookingId: 'a1000001-a100-4000-8000-000000000001',
    },
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 2,
    totalPages: 1,
  },
  summary: {
    total: 2,
    classCount: 1,
    bookingCount: 1,
    upcomingCount: 2,
    liveCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    pendingConfirmationCount: 0,
    distinctCoachCount: 1,
    nextSessionAt: '2026-07-19T09:00:00.000Z',
    lastSessionAt: '2026-07-20T09:00:00.000Z',
  },
  filters: {
    kind: 'all',
    state: 'upcoming',
    coachProfileId: null,
    classId: null,
    from: null,
    to: null,
    page: 1,
    limit: 10,
    sort: 'asc',
  },
};

@ApiTags('Learning Schedule')
@Controller('api/learner/schedule')
export class LearningScheduleController {
  constructor(private readonly learningScheduleService: LearningScheduleService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Learner) Get my combined learning schedule',
    description:
      'Returns a unified timeline of class session occurrences and private booking sessions for the current learner.\n\n' +
      'Use the filters below to power calendar, agenda, and coach-specific views in the UI.\n\n' +
      '- `kind=class|booking|all` to scope the source\n' +
      '- `state=upcoming|live|past|pending|all` to switch between timeline tabs\n' +
      '- `coachProfileId` and `classId` for deep filtering\n' +
      '- `from` / `to` for date-range pickers\n' +
      '- `sort=asc|desc` for agenda ordering',
  })
  @ApiQuery({ name: 'kind', required: false, enum: ['all', 'class', 'booking'], description: 'Source filter.' })
  @ApiQuery({ name: 'state', required: false, enum: ['all', 'upcoming', 'live', 'past', 'pending'], description: 'Timeline filter. Default is upcoming.' })
  @ApiQuery({ name: 'coachProfileId', required: false, type: String, description: 'Filter by coach profile UUID.' })
  @ApiQuery({ name: 'classId', required: false, type: String, description: 'Filter by class UUID.' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Start time lower bound (ISO 8601 UTC).' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Start time upper bound (ISO 8601 UTC).' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'sort', required: false, enum: ['asc', 'desc'], description: 'Sort by start time.' })
  @ApiResponse({
    status: 200,
    description: 'Combined learning schedule returned successfully.',
    schema: { example: LEARNING_SCHEDULE_EXAMPLE },
  })
  @HttpCode(HttpStatus.OK)
  list(@Request() req: any, @Query() query: ListLearningScheduleQueryDto) {
    return this.learningScheduleService.listLearnerSchedule(req.user.userId, query);
  }
}