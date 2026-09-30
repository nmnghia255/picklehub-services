import { Controller, Get, Post, Body, UseGuards, NotFoundException, Param } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { RunService } from '../run/run.service';
import { InternalTokenGuard } from '../guards/internal-token.guard';
import { QueryTournamentsInternalDto } from './dto/query-tournaments-internal.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';

@ApiTags('internal')
@Controller('internal')
@UseGuards(InternalTokenGuard)
@ApiSecurity('internal-service-token')
export class InternalController {
  constructor(
    private readonly tournamentsService: TournamentsService,
    private readonly runService: RunService,
  ) {}

  @Post('query-by-player')
  @ApiOperation({
    summary: '[Internal] Query tournaments and matches by player',
    description: 'Retrieves tournaments and matches of a player within date range.',
  })
  @ApiResponse({
    status: 200,
    description: 'Player tournaments and matches retrieved successfully.',
  })
  queryPlayerTournamentsAndMatches(@Body() dto: QueryTournamentsInternalDto) {
    return this.tournamentsService.queryPlayerTournamentsAndMatches(dto.userId, dto.startDate, dto.endDate);
  }

  @Post('fixtures/sync-by-uuid')
  @ApiOperation({
    summary: '[Internal] Sync tournament fixtures by tournament UUID',
    description: 'Triggers the sync and bracket advancement process for a tournament by its UUID.',
  })
  @ApiResponse({ status: 200, description: 'Fixtures synced successfully.' })
  async syncByUuid(@Body() dto: { tournamentUuid: string }) {
    const tournament = await this.tournamentsService.findByUuid(dto.tournamentUuid);
    if (!tournament) throw new NotFoundException('Tournament not found.');
    return this.runService.syncResults(tournament.id);
  }

  @Get('tournaments/:tournamentId/access/:userId')
  @ApiOperation({
    summary: '[Internal] Check tournament chat access',
    description: 'Used by chat-service to verify tournament conversation access.',
  })
  @ApiResponse({ status: 200, description: 'Tournament chat access granted.' })
  checkTournamentChatAccess(
    @Param('tournamentId') tournamentId: string,
    @Param('userId') userId: string,
  ) {
    return this.tournamentsService.checkChatAccess(tournamentId, userId);
  }
}
