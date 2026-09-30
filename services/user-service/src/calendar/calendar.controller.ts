import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse as SwaggerApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CalendarService } from './calendar.service';
import { UnifiedCalendarItem } from './calendar.types';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface AuthenticatedRequest {
  user: {
    id: string;
    email?: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
}

@ApiTags('User Calendar')
@Controller('me/calendar')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  @ApiOperation({
    summary: 'Get my aggregated activity calendar',
    description:
      'Fetches and merges all user activities (bookings, social play sessions, practice matches, tournament matches, and tournaments) into a unified timeline.\n\n' +
      '**Activity Types (type field):**<br/>' +
      '• **BOOKING**: Free/recreational court booking.<br/>' +
      '• **SOCIAL_SESSION**: Social play session.<br/>' +
      '• **LEARNING_SESSION**: Coach-led class or private booking session.<br/>' +
      '• **MATCH_PRACTICE**: Practice match (recreational, match-service).<br/>' +
      '• **MATCH_TOURNAMENT**: Tournament match (tournament-service).<br/>' +
      '• **TOURNAMENT**: Registered tournament itself.<br/><br/>' +
      '**Activity Statuses (status field):**<br/>' +
      '• **UPCOMING**: Scheduled in the future.<br/>' +
      '• **LIVE**: Currently active/ongoing.<br/>' +
      '• **PENDING_CONFIRM**: Pending host or payment confirmation.<br/>' +
      '• **COMPLETED**: Completed activity.<br/>' +
      '• **CANCELLED**: Cancelled activity.<br/><br/>' +
      '**User Roles (role field):**<br/>' +
      '• **HOST**: The organizer/creator of the activity.<br/>' +
      '• **PLAYER**: A participant/player in the activity.<br/>' +
        '• **LEARNER**: A learner attending a coach class or booking session.<br/>' +
      '• **REFEREE**: The referee for the match.<br/>' +
      '• **ORGANIZER**: The tournament organizer.'
  })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date filter (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date filter (YYYY-MM-DD)' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Calendar aggregated successfully.',
    schema: {
      example: {
        success: true,
        message: 'User calendar aggregated successfully',
        data: {
          items: [
            {
              id: 'b0040000-b004-4000-8000-000000010012_0',
              type: 'BOOKING',
              title: 'Booking Court A - PickleHub Downtown',
              startTime: '2026-06-29T08:00:00.000Z',
              endTime: '2026-06-29T10:00:00.000Z',
              location: {
                name: 'PickleHub Downtown',
                address: '123 Main St, District 1, HCMC',
                centerId: 'c0000000-c000-4000-8000-000000000001'
              },
              status: 'UPCOMING',
              role: 'PLAYER',
              metadata: {
                bookingId: 'b0040000-b004-4000-8000-000000010012',
                paymentStatus: 'PAID'
              }
            }
          ],
          warnings: []
        }
      }
    }
  })
  async getMyCalendar(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<ApiResponse<{ items: UnifiedCalendarItem[]; warnings: string[] }>> {
    const userId = req.user.id;
    const result = await this.calendarService.getMergedCalendar(userId, startDate, endDate);
    return {
      success: true,
      message: 'User calendar aggregated successfully',
      data: result,
    };
  }
}
