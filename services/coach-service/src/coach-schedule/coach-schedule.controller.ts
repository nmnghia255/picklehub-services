import { Controller, Get, HttpCode, HttpStatus, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CoachScheduleService } from './coach-schedule.service';
import { ListCoachScheduleQueryDto } from './dto/list-coach-schedule-query.dto';
import { RequireSubscription } from '../guards/subscription.guard';

const COACH_SCHEDULE_EXAMPLE = {
  data: [
    {
      id: 'e0000001-e000-4000-8000-000000000001',
      kind: 'class',
      title: 'Khóa Học Pickleball Cho Người Mới Bắt Đầu',
      startsAt: '2026-07-19T02:00:00.000Z',
      endsAt: '2026-07-19T04:00:00.000Z',
      durationMinutes: 120,
      status: 'UPCOMING',
      sourceStatus: 'OPEN',
      coachProfile: {
        id: 'c0000001-c000-4000-8000-000000000001',
        displayName: 'Nguyễn Văn Hùng',
        avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=200',
        verificationStatus: 'VERIFIED',
        locationCity: 'Hồ Chí Minh',
      },
      learnerProfile: null,
      locationDescription: 'Sân Pickleball 360, 123 Lê Văn Lương, Q. Gò Vấp, TP. HCM',
      topic: 'Giới thiệu môn Pickleball và quy tắc cơ bản',
      note: 'Mang giày thể thao. Vợt sẽ được cho mượn.',
      paymentStatus: null,
      classId: 'f0000001-f000-4000-8000-000000000001',
      bookingId: null,
      classTitle: 'Khóa Học Pickleball Cho Người Mới Bắt Đầu',
    },
    {
      id: 'a1000001-a100-4000-8000-000000000001',
      kind: 'booking',
      title: 'Private booking with Learner One',
      startsAt: '2026-07-20T09:00:00.000Z',
      endsAt: '2026-07-20T10:00:00.000Z',
      durationMinutes: 60,
      status: 'UPCOMING',
      sourceStatus: 'CONFIRMED',
      coachProfile: {
        id: 'c0000001-c000-4000-8000-000000000001',
        displayName: 'Nguyễn Văn Hùng',
        avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&q=80&w=200',
        verificationStatus: 'VERIFIED',
        locationCity: 'Hồ Chí Minh',
      },
      learnerProfile: {
        id: 'a0000010-a000-4000-8000-000000000010',
        name: 'Learner One',
        email: 'learner1@example.com',
        role: 'USER',
        avatarUrl: 'https://cdn.picklehub.vn/avatars/learner1.jpg',
      },
      locationDescription: 'Hồ Chí Minh',
      topic: null,
      note: 'Xác nhận buổi tập. Vui lòng chuyển khoản và gửi minh chứng.',
      paymentStatus: 'PENDING_PROOF',
      classId: null,
      bookingId: 'a1000001-a100-4000-8000-000000000001',
      classTitle: null,
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
    distinctLearnerCount: 1,
    nextSessionAt: '2026-07-19T02:00:00.000Z',
    lastSessionAt: '2026-07-20T09:00:00.000Z',
  },
  filters: {
    kind: 'all',
    state: 'upcoming',
    learnerId: null,
    classId: null,
    from: null,
    to: null,
    page: 1,
    limit: 10,
    sort: 'asc',
  },
};

@ApiTags('Coach Schedule')
@Controller('api/coach/schedule')
@RequireSubscription('COACH')
export class CoachScheduleController {
  constructor(private readonly coachScheduleService: CoachScheduleService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Get my combined coaching schedule',
    description:
      'Returns the coach\'s own class session timetable and private booking sessions in one unified timeline.\n\n' +
      'Useful filters for the coach UI: `kind`, `state`, `learnerId`, `classId`, `from`, `to`, `page`, `limit`, and `sort`.',
  })
  @ApiQuery({ name: 'kind', required: false, enum: ['all', 'class', 'booking'], description: 'Scope the source records.' })
  @ApiQuery({ name: 'state', required: false, enum: ['all', 'upcoming', 'live', 'past', 'pending'], description: 'Timeline tab.' })
  @ApiQuery({ name: 'learnerId', required: false, type: String, description: 'Focus on a specific learner.' })
  @ApiQuery({ name: 'classId', required: false, type: String, description: 'Focus on a specific class.' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'From datetime (ISO 8601 UTC).' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'To datetime (ISO 8601 UTC).' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'sort', required: false, enum: ['asc', 'desc'], description: 'Sort by start time.' })
  @ApiResponse({
    status: 200,
    description: 'Coach schedule returned successfully.',
    schema: { example: COACH_SCHEDULE_EXAMPLE },
  })
  @HttpCode(HttpStatus.OK)
  list(@Request() req: any, @Query() query: ListCoachScheduleQueryDto) {
    return this.coachScheduleService.listCoachSchedule(req.user.userId, query);
  }
}
