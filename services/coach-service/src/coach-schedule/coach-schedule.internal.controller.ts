import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { InternalGuard } from '../guards/internal.guard';
import { CoachScheduleService } from './coach-schedule.service';
import { InternalListCoachScheduleQueryDto } from './dto/internal-list-coach-schedule-query.dto';

const INTERNAL_COACH_SCHEDULE_EXAMPLE = {
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
      learnerProfile: null,
      locationDescription: 'Sân Pickleball 360, 123 Lê Văn Lương, Q. Gò Vấp, TP. HCM',
      topic: 'Giới thiệu môn Pickleball và quy tắc cơ bản',
      note: 'Mang giày thể thao. Vợt sẽ được cho mượn.',
      paymentStatus: null,
      classId: 'f0000001-f000-4000-8000-000000000001',
      bookingId: null,
      classTitle: 'Pickleball Beginner Boot Camp',
    },
  ],
};

@ApiTags('Coach Schedule')
@Controller('api/coach/schedule/internal')
@UseGuards(InternalGuard)
@ApiSecurity('internal-token')
export class CoachScheduleInternalController {
  constructor(private readonly coachScheduleService: CoachScheduleService) {}

  @Get('query-by-user')
  @ApiOperation({
    summary: '(Internal) Query coach teaching schedule by user id',
    description:
      'Service-to-service feed for the user-service calendar aggregation. Returns the same combined teaching schedule items used by the coach-facing endpoint, filtered by date range and optionally by kind/state.',
  })
  @ApiQuery({ name: 'kind', required: false, enum: ['all', 'class', 'booking'] })
  @ApiQuery({ name: 'state', required: false, enum: ['all', 'upcoming', 'live', 'past', 'pending'] })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Combined teaching schedule items returned successfully.',
    schema: { example: INTERNAL_COACH_SCHEDULE_EXAMPLE },
  })
  async queryByUser(
    @Query() query: InternalListCoachScheduleQueryDto,
  ) {
    const items = await this.coachScheduleService.getCoachScheduleItems(query.userId, query);
    return { items };
  }
}
