import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { InternalGuard } from '../guards/internal.guard';
import { LearningScheduleService } from './learning-schedule.service';
import { InternalListLearningScheduleQueryDto } from './dto/internal-list-learning-schedule-query.dto';

const INTERNAL_LEARNING_SCHEDULE_EXAMPLE = {
  items: [
    {
      id: 'e0000001-e000-4000-8000-000000000001',
      kind: 'class',
      title: 'Pickleball Beginner Boot Camp',
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
      locationDescription: 'Sân Pickleball 360, 123 Lê Văn Lương, Q. Gò Vấp, TP. HCM',
      topic: 'Giới thiệu môn Pickleball và quy tắc cơ bản',
      note: 'Mang giày thể thao. Vợt sẽ được cho mượn.',
      paymentStatus: null,
      classId: 'f0000001-f000-4000-8000-000000000001',
      bookingId: null,
    },
    {
      id: 'a1000006-a100-4000-8000-000000000006',
      kind: 'booking',
      title: 'Private session with Nguyễn Văn Hùng',
      startsAt: '2026-07-18T09:00:00.000Z',
      endsAt: '2026-07-18T10:00:00.000Z',
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
      locationDescription: 'Hồ Chí Minh',
      topic: null,
      note: 'Xác nhận buổi tập lúc 9h sáng. Sân số 3. Vui lòng đến trước 5 phút.',
      paymentStatus: 'SETTLED',
      classId: null,
      bookingId: 'a1000006-a100-4000-8000-000000000006',
    },
  ],
};

@ApiTags('Learning Schedule')
@Controller('api/learner/schedule/internal')
@UseGuards(InternalGuard)
@ApiSecurity('internal-token')
export class LearningScheduleInternalController {
  constructor(private readonly learningScheduleService: LearningScheduleService) {}

  @Get('query-by-user')
  @ApiOperation({
    summary: '(Internal) Query learner learning schedule by user id',
    description:
      'Service-to-service feed for the user-service calendar aggregation. Returns the same combined learning schedule items used by the learner-facing endpoint, filtered by date range and optionally by kind/state.',
  })
  @ApiQuery({ name: 'kind', required: false, enum: ['all', 'class', 'booking'] })
  @ApiQuery({ name: 'state', required: false, enum: ['all', 'upcoming', 'live', 'past', 'pending'] })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Combined learning schedule items returned successfully.',
    schema: { example: INTERNAL_LEARNING_SCHEDULE_EXAMPLE },
  })
  async queryByUser(
    @Query() query: InternalListLearningScheduleQueryDto,
  ) {
    const items = await this.learningScheduleService.getLearnerScheduleItems(query.userId, query);
    return { items };
  }
}