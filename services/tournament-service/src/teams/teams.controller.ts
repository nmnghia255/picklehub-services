import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamResponseDto } from './dto/team-response.dto';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@ApiTags('Tournament Teams')
@Controller(':tournamentId/events/:eventId')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get('teams')
  @ApiOperation({
    summary: 'Get all event teams',
    description: 'Returns the list of all registered and formed teams in a specific event division.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The event division ID' })
  @ApiResponse({ status: 200, description: 'List of teams retrieved successfully.', type: [TeamResponseDto] })
  findAll(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.teamsService.findAll(tournamentId, eventId);
  }
}
