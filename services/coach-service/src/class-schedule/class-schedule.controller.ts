import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ClassScheduleService } from './class-schedule.service';
import { CreateClassScheduleDto } from './dto/create-class-schedule.dto';
import { UpdateSessionLocationDto } from '../common/dto/update-session-location.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequireSubscription } from '../guards/subscription.guard';

// ─── Shared Swagger example objects ───────────────────────────────────────────

const SCHEDULE_EXAMPLE = {
  id: 'e0000001-e000-4000-8000-000000000001',
  classId: 'f0000001-f000-4000-8000-000000000001',
  scheduledAt: '2026-07-19T09:00:00.000Z',
  durationMinutes: 90,
  topic: 'Luyện tập kỹ thuật serve và return',
  note: 'Mang vợt riêng. Sân số 3.',
  createdAt: '2026-07-01T00:00:00.000Z',
};

// ─────────────────────────────────────
//  Schedule endpoints: /api/coach/classes/:classId/schedules
// ─────────────────────────────────────

@ApiTags('Class Schedules — Coach Actions')
@Controller('api/coach/classes/:classId/schedules')
@RequireSubscription('COACH')
export class ClassScheduleController {
  constructor(private readonly scheduleService: ClassScheduleService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Add a session slot to a class',
    description:
      'Adds an individual session occurrence to an existing class. A class can have multiple schedule entries representing each physical session.\n\n' +
      '**Example use-case:** A 4-week class meeting every Saturday 7–9am would have 4 entries, one per Saturday.\n\n' +
      'Can be added at any time regardless of class status (DRAFT or OPEN).',
  })
  @ApiParam({ name: 'classId', description: 'Class UUID.', example: 'f0000001-f000-4000-8000-000000000001' })
  @ApiResponse({
    status: 201,
    description: 'Schedule entry created.',
    schema: { example: SCHEDULE_EXAMPLE },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden — class belongs to another coach.', schema: { example: { statusCode: 403, message: 'You do not own this class.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Class not found.', schema: { example: { statusCode: 404, message: 'Class not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.CREATED)
  addSchedule(
    @Request() req: any,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: CreateClassScheduleDto,
  ) {
    return this.scheduleService.addSchedule(req.user.userId, classId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) List all schedule entries for a class',
    description: 'Returns all session slots for a specific class, ordered chronologically by `scheduledAt`.',
  })
  @ApiParam({ name: 'classId', description: 'Class UUID.', example: 'f0000001-f000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'List of schedule entries.',
    schema: {
      example: [
        SCHEDULE_EXAMPLE,
        { ...SCHEDULE_EXAMPLE, id: 'e0000002-e000-4000-8000-000000000002', scheduledAt: '2026-07-26T09:00:00.000Z', note: null },
        { ...SCHEDULE_EXAMPLE, id: 'e0000003-e000-4000-8000-000000000003', scheduledAt: '2026-08-02T09:00:00.000Z', note: null },
      ],
    },
  })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Return only schedules whose `scheduledAt` is on or after this date (ISO 8601, UTC).' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Return only schedules whose `scheduledAt` is on or before this date (ISO 8601, UTC).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You do not own this class.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Class not found.', schema: { example: { statusCode: 404, message: 'Class not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  listSchedules(
    @Request() req: any,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.scheduleService.listSchedules(req.user.userId, classId, from, to);
  }

  @Delete(':scheduleId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Remove a session slot',
    description: 'Permanently deletes an individual schedule entry from the class. Only the class owner can remove schedule entries.',
  })
  @ApiParam({ name: 'classId', description: 'Class UUID.', example: 'f0000001-f000-4000-8000-000000000001' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule entry UUID.', example: 'e0000001-e000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Schedule entry removed.',
    schema: { example: { message: 'Schedule entry removed successfully.' } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden.', schema: { example: { statusCode: 403, message: 'You do not own this class.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Schedule entry not found.', schema: { example: { statusCode: 404, message: 'Schedule entry not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  removeSchedule(
    @Request() req: any,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  ) {
    return this.scheduleService.removeSchedule(req.user.userId, classId, scheduleId);
  }

  @Patch(':scheduleId/location')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '(Coach) Link or update the venue / court for a session',
    description:
      'Updates the location for a single class session occurrence.\n\n' +
      '**Mode A — court link:** Provide `courtBookingId` (+ `courtId` if the booking covers multiple courts). ' +
      'The court booking must be CONFIRMED and owned by the authenticated coach. ' +
      'The full court address is resolved automatically and overrides any existing free-text location.\n\n' +
      '**Mode B — free text:** Provide `locationDescription`. Wipes any existing court link.\n\n' +
      '**Mode C — clear:** Send an empty body `{}` to reset both location and court link to null.',
  })
  @ApiParam({ name: 'classId', description: 'Class UUID.', example: 'f0000001-f000-4000-8000-000000000001' })
  @ApiParam({ name: 'scheduleId', description: 'Schedule entry UUID.', example: 'e0000001-e000-4000-8000-000000000001' })
  @ApiResponse({
    status: 200,
    description: 'Location updated.',
    schema: {
      example: {
        ...SCHEDULE_EXAMPLE,
        courtBookingId: 'b1c2d3e4-f5a6-7890-bcde-f12345678901',
        courtId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        courtCostVnd: 300000,
        locationDescription: null,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request — invalid court booking or booking not owned by coach.', schema: { example: { statusCode: 400, message: 'Court booking is not CONFIRMED.', error: 'Bad Request' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized.', schema: { example: { statusCode: 401, message: 'Missing or invalid Authorization header', error: 'Unauthorized' } } })
  @ApiResponse({ status: 403, description: 'Forbidden — class or court booking belongs to another coach.', schema: { example: { statusCode: 403, message: 'You do not own this class.', error: 'Forbidden' } } })
  @ApiResponse({ status: 404, description: 'Class or schedule not found.', schema: { example: { statusCode: 404, message: 'Schedule entry not found.', error: 'Not Found' } } })
  @HttpCode(HttpStatus.OK)
  updateScheduleLocation(
    @Request() req: any,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: UpdateSessionLocationDto,
  ) {
    return this.scheduleService.updateScheduleLocation(req.user.userId, classId, scheduleId, dto);
  }
}
