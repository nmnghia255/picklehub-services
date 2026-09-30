import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TournamentOrganizerGuard } from '../guards/tournament-organizer.guard';
import { BookingsService } from './bookings.service';
import { ScheduleFixtureDto } from './dto/schedule-fixture.dto';
import { AutoScheduleConfigDto } from './dto/auto-schedule-config.dto';
import { ConfirmScheduleDto } from './dto/confirm-schedule.dto';

/** An enriched fixture as returned to the FE (see `docs/types.ts` `Match`). */
const FIXTURE_VIEW_EXAMPLE = {
  id: 12,
  event: "Men's Doubles",
  round: 'Semifinal',
  team1: { teamId: 100, name: 'Alice / Bob', seed: 1, rating: 4.2, score: null },
  team2: { teamId: 200, name: 'Carol / Dan', seed: 4, rating: 3.8, score: null },
  winner: null,
  score: null,
  status: 'scheduled',
  court: 'San 1',
  courtId: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
  courtStatus: 'available',
  externalMatchId: null,
  bookingId: 5,
  bookingItemId: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
};

@ApiTags('Tournament Schedule')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller(':tournamentId')
export class FixturesController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Patch('fixtures/:fixtureId/schedule')
  @UseGuards(TournamentOrganizerGuard)
  @ApiOperation({
    summary: 'Schedule a fixture onto a booked slot',
    description: 'Links a fixture to a specific court+time slot (booking item) of a booking. Rejects if the slot is already used by another fixture.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'fixtureId', type: Number, description: 'Local match (fixture) id' })
  @ApiResponse({
    status: 200,
    description: 'Fixture scheduled; returns the fixture enriched to the FE Match shape.',
    content: { 'application/json': { example: FIXTURE_VIEW_EXAMPLE } },
  })
  @ApiResponse({ status: 400, description: 'Item not in booking, or slot already assigned.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament, fixture or booking not found.' })
  schedule(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('fixtureId', ParseIntPipe) fixtureId: number,
    @Body() dto: ScheduleFixtureDto,
  ) {
    return this.bookingsService.scheduleFixture(tournamentId, fixtureId, dto);
  }

  @Delete('fixtures/:fixtureId/booking')
  @UseGuards(TournamentOrganizerGuard)
  @ApiOperation({
    summary: 'Unlink a fixture from its booking',
    description: 'Detaches the fixture from its booked slot (needed before removing its center).',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'fixtureId', type: Number, description: 'Local match (fixture) id' })
  @ApiResponse({
    status: 200,
    description: 'Fixture unlinked; returns the fixture enriched to the FE Match shape (court now null).',
    content: { 'application/json': { example: { ...FIXTURE_VIEW_EXAMPLE, court: null, courtId: null, courtStatus: null, bookingId: null, bookingItemId: null } } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament or fixture not found.' })
  unlink(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('fixtureId', ParseIntPipe) fixtureId: number,
  ) {
    return this.bookingsService.unlinkFixture(tournamentId, fixtureId);
  }

  @Get('schedule')
  @ApiOperation({
    summary: 'Fixture schedule timeline',
    description:
      'Returns the tournament fixtures enriched to the FE Match shape (teams, court name + status, event, winner as 1/2), plus a count of fixtures that still need a booking.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiQuery({ name: 'eventId', type: Number, required: false, description: 'Filter fixtures by event category ID' })
  @ApiQuery({ name: 'courtId', type: Number, required: false, description: 'Filter fixtures by local court ID' })
  @ApiQuery({ name: 'date', type: String, required: false, description: 'Filter fixtures by date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'status', type: String, required: false, enum: ['scheduled', 'ready', 'in_progress', 'completed', 'walkover', 'pending'], description: 'Filter fixtures by match status' })
  @ApiResponse({
    status: 200,
    description: 'Schedule retrieved.',
    content: {
      'application/json': {
        example: {
          data: [
            {
              id: 12,
              event: "Men's Doubles",
              round: 'Semifinal',
              team1: { teamId: 100, name: 'Alice / Bob', seed: 1, rating: 4.2, score: null },
              team2: { teamId: 200, name: 'Carol / Dan', seed: 4, rating: 3.8, score: null },
              winner: null,
              score: null,
              status: 'scheduled',
              court: 'San 1',
              courtId: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
              courtStatus: 'available',
              externalMatchId: null,
              bookingId: 5,
              bookingItemId: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
              refereeId: null,
              refereeName: null,
            },
          ],
          meta: { total: 7, bookingsRemaining: 2 },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  scheduleList(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Query('eventId') eventId?: string,
    @Query('courtId') courtId?: string,
    @Query('date') date?: string,
    @Query('status') status?: string,
  ) {
    const parsedEventId = eventId ? parseInt(eventId, 10) : undefined;
    const parsedCourtId = courtId ? parseInt(courtId, 10) : undefined;
    return this.bookingsService.getSchedule(
      tournamentId,
      parsedEventId,
      parsedCourtId,
      date,
      status,
    );
  }

  @Post('events/:eventId/auto-schedule/preview')
  @UseGuards(TournamentOrganizerGuard)
  @ApiOperation({
    summary: 'Xem trước kết quả xếp lịch thi đấu tự động',
    description: 'Chạy thử thuật toán xếp lịch tự động trên bộ nhớ in-memory để tính toán thời gian hoàn thành dự kiến, số lượng trận xếp được, số sân sử dụng và các cảnh báo trùng lịch.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'eventId', type: Number })
  @ApiResponse({ status: 200, description: 'Xem trước thành công. Trả về danh sách phân bổ trận đấu và các cảnh báo khoảng nghỉ VĐV.' })
  @ApiResponse({ status: 401, description: 'Không có quyền truy cập.' })
  @ApiResponse({ status: 403, description: 'Từ chối truy cập: Bạn không phải ban tổ chức giải đấu.' })
  autoSchedulePreview(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: AutoScheduleConfigDto,
  ) {
    return this.bookingsService.autoScheduleFixturesPreview(tournamentId, eventId, dto);
  }

  @Post('events/:eventId/auto-schedule/confirm')
  @UseGuards(TournamentOrganizerGuard)
  @ApiOperation({
    summary: 'Xác nhận và lưu lịch thi đấu chính thức',
    description: 'Xác thực cách phân bổ trận đấu tùy chỉnh của Frontend và lưu chính thức vào cơ sở dữ liệu, ghi log kiểm toán và gửi thông báo cho VĐV.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'eventId', type: Number })
  @ApiResponse({ status: 201, description: 'Lưu lịch thi đấu thành công.' })
  @ApiResponse({ status: 400, description: 'Yêu cầu không hợp lệ (trùng lịch sân đấu hoặc thời lượng đặt sân không đủ).' })
  @ApiResponse({ status: 401, description: 'Không có quyền truy cập.' })
  @ApiResponse({ status: 403, description: 'Từ chối truy cập: Bạn không phải ban tổ chức giải đấu.' })
  confirmSchedule(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: ConfirmScheduleDto,
  ) {
    return this.bookingsService.confirmAutoScheduleFixtures(tournamentId, eventId, dto);
  }

  @Post('events/:eventId/auto-schedule/validate')
  @UseGuards(TournamentOrganizerGuard)
  @ApiOperation({
    summary: 'Xác thực bản nháp lịch thi đấu',
    description: 'Chạy kiểm tra in-memory và trả về danh sách cảnh báo trùng lịch hoặc khoảng nghỉ ngắn của VĐV phục vụ thao tác kéo thả nháp trên Frontend.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'eventId', type: Number })
  @ApiResponse({ status: 200, description: 'Xác thực thành công. Trả về mảng các cảnh báo trùng lịch/khoảng nghỉ VĐV.' })
  validateSchedule(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: ConfirmScheduleDto,
  ) {
    return this.bookingsService.validateSchedule(tournamentId, eventId, dto);
  }

  @Get('events/:eventId/matches')
  @ApiOperation({
    summary: 'Get matches for a specific event',
    description: 'Returns the event fixtures enriched to the FE Match shape.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'eventId', type: Number })
  @ApiQuery({ name: 'scheduled', type: Boolean, required: false, description: 'Filter by scheduled status (true = has court assigned, false = unassigned)' })
  @ApiResponse({ status: 200, description: 'Matches retrieved.' })
  @ApiResponse({ status: 404, description: 'Tournament or event not found.' })
  getEventMatches(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Query('scheduled') scheduled?: string,
  ) {
    const isScheduled = scheduled !== undefined ? scheduled === 'true' : undefined;
    return this.bookingsService.getSchedule(
      tournamentId,
      eventId,
      undefined,
      undefined,
      undefined,
      isScheduled,
    );
  }
}
