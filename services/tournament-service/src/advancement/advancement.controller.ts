import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { AdvancementService } from './advancement.service';
import { StandingsResponseDto } from './dto/standings-response.dto';

@ApiTags('Tournament Standings')
@Controller(':tournamentId/events/:eventId')
export class AdvancementController {
  constructor(private readonly advancement: AdvancementService) {}

  @Get('standings')
  @ApiOperation({
    summary: 'Event standings',
    description: 'Final placement table for an event, derived from the bracket results (champion, runner-up, round eliminated, win/loss).',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'eventId', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Standings returned.',
    content: {
      'application/json': {
        example: {
          data: [
            { position: 1, teamId: 100, name: 'Alice / Bob', seed: 1, wins: 3, losses: 0, result: 'Champion' },
            { position: 2, teamId: 200, name: 'Carol / Dan', seed: 4, wins: 2, losses: 1, result: 'Runner-up' },
            { position: 3, teamId: 300, name: 'Eve / Frank', seed: 2, wins: 1, losses: 1, result: 'Eliminated — Semifinal' },
          ],
          meta: { total: 4, championTeamId: 100, championTeamName: 'Alice / Bob' },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Tournament or event not found.' })
  standings(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<StandingsResponseDto> {
    return this.advancement.getStandings(tournamentId, eventId);
  }
}
