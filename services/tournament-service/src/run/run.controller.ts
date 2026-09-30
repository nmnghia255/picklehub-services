import { Body, Controller, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TournamentOrganizerGuard } from '../guards/tournament-organizer.guard';
import { RunService } from './run.service';
import { DispatchFixturesDto } from './dto/dispatch-fixtures.dto';
import { RecordResultDto } from './dto/record-result.dto';

/** An enriched fixture as returned to the FE (see `docs/types.ts` `Match`). */
const MATCH_VIEW_EXAMPLE = {
  id: 12,
  event: "Men's Doubles",
  round: 'Semifinal',
  team1: {
    teamId: 100,
    name: 'Alice / Bob',
    seed: 1,
    rating: 4.2,
    score: 11,
    player1: { id: 'p1-uuid', name: 'Alice', rating: 4.2, gender: 'F', duprId: null },
    player2: { id: 'p2-uuid', name: 'Bob', rating: 4.2, gender: 'M', duprId: null },
  },
  team2: {
    teamId: 200,
    name: 'Carol / Dan',
    seed: 4,
    rating: 3.8,
    score: 8,
    player1: { id: 'p3-uuid', name: 'Carol', rating: 3.8, gender: 'F', duprId: null },
    player2: { id: 'p4-uuid', name: 'Dan', rating: 3.8, gender: 'M', duprId: null },
  },
  winner: 1,
  score: '11-8',
  status: 'completed',
  court: 'San 1',
  courtId: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
  courtStatus: 'available',
  externalMatchId: 'e0000001-e000-4000-8000-000000000001',
  bookingId: 5,
  bookingItemId: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
};

@ApiTags('Tournament Match Run')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
@Controller(':tournamentId')
export class RunController {
  constructor(private readonly run: RunService) {}

  @Post('fixtures/dispatch')
  @ApiOperation({
    summary: 'Chuyển các trận đấu đã sẵn sàng sang hệ thống thi đấu (match-service)',
    description:
      'Đẩy toàn bộ các trận đấu đã có cặp đấu thực tế và đã được xếp sân (chưa được gửi đi trước đó) sang match-service để bắt đầu thi đấu. API có tính lũy đẳng — chỉ xử lý các trận đấu mới sẵn sàng xếp lịch.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Ủy thác thành công. Trả về số lượng, các trận bị bỏ qua và danh sách trận đấu đã được cấu trúc lại cho Frontend.',
    content: {
      'application/json': {
        example: {
          dispatched: 1,
          skipped: [{ fixtureId: 14, reason: 'booked slot no longer resolves to a court' }],
          fixtures: [{ ...MATCH_VIEW_EXAMPLE, status: 'ready', winner: null, score: null }],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy giải đấu.' })
  @ApiResponse({ status: 403, description: 'Từ chối truy cập: Bạn không phải ban tổ chức giải đấu.' })
  dispatch(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() dto: DispatchFixturesDto,
    @Req() req: any,
  ) {
    return this.run.dispatchFixtures(tournamentId, req.user?.sub, dto.eventId, req.headers?.authorization);
  }

  @Post('fixtures/:fixtureId/result')
  @ApiOperation({
    summary: 'Ghi nhận kết quả trận đấu',
    description:
      'Xác nhận tỷ số và đóng kết quả trận đấu trên match-service, sau đó phản ánh trực tiếp kết quả đó trở lại sơ đồ bảng đấu.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'fixtureId', type: Number, description: 'ID trận đấu cục bộ (fixtureId)' })
  @ApiResponse({
    status: 201,
    description: 'Ghi nhận tỷ số thành công và cập nhật lên sơ đồ bảng đấu.',
    content: {
      'application/json': {
        example: {
          fixture: MATCH_VIEW_EXAMPLE,
          match: { status: 'CONFIRMED', winner: 'TEAM_A', scoreA: 11, scoreB: 8 },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Trận đấu chưa được gửi đi, hoặc match-service từ chối tỷ số này.' })
  @ApiResponse({ status: 403, description: 'Từ chối truy cập: Bạn không phải ban tổ chức giải đấu.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy giải đấu hoặc trận đấu.' })
  result(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('fixtureId', ParseIntPipe) fixtureId: number,
    @Body() dto: RecordResultDto,
    @Req() req: any,
  ) {
    return this.run.recordResult(tournamentId, fixtureId, dto, req.user?.sub, req.headers?.authorization);
  }

  @Post('fixtures/sync')
  @ApiOperation({
    summary: 'Đồng bộ kết quả từ hệ thống thi đấu (match-service)',
    description: 'Quét toàn bộ danh sách trận đấu trên match-service để cập nhật cục bộ trạng thái (LIVE -> in_progress, CONFIRMED -> completed) và tỷ số chi tiết.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Đồng bộ thành công. Trả về số lượng trận đấu được cập nhật và thông tin chi tiết.',
    content: {
      'application/json': {
        example: { synced: 1, fixtures: [MATCH_VIEW_EXAMPLE] },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Từ chối truy cập: Bạn không phải ban tổ chức giải đấu.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy giải đấu.' })
  sync(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return this.run.syncResults(tournamentId);
  }
}
