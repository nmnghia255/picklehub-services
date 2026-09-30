import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GroupStageService } from './group-stage.service';
import { ConfigureGroupStageDto } from './dto/configure-group-stage.dto';
import { DrawGroupsDto } from './dto/draw-groups.dto';
import { GroupStageGroupResponseDto } from './dto/group-stage-response.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TournamentOrganizerGuard } from '../guards/tournament-organizer.guard';
import { EventResponseDto } from '../events/dto/event-response.dto';

@ApiTags('Tournament Group Stage')
@Controller(':tournamentId/events/:eventId/group-stage')
export class GroupStageController {
  constructor(private readonly groupStageService: GroupStageService) { }

  @Post('configure')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Configure group stage for an event',
    description: 'Enables/disables group stage and sets groups & advancement configuration.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'eventId', type: Number })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully.', type: EventResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  configure(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: ConfigureGroupStageDto,
  ) {
    return this.groupStageService.configure(tournamentId, eventId, dto);
  }

  @Post('draw')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Draw teams into groups',
    description: 'Shuffles locked seeds randomly and distributes them evenly to the configured groups.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'eventId', type: Number })
  @ApiResponse({ status: 200, type: [GroupStageGroupResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  drawGroups(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: DrawGroupsDto,
  ) {
    return this.groupStageService.drawGroups(tournamentId, eventId, dto);
  }

  @Get('groups')
  @ApiOperation({
    summary: 'Get groups and their standings',
    description: 'Retrieves all groups with their current standings ordered by rank.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'eventId', type: Number })
  @ApiResponse({ status: 200, type: [GroupStageGroupResponseDto] })
  getGroups(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.groupStageService.getGroups(tournamentId, eventId);
  }

  @Post('generate-matches')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Generate round-robin matches',
    description: 'Generates round-robin fixtures for all teams in each group.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'eventId', type: Number })
  @ApiResponse({ status: 200, description: 'Matches generated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  generateMatches(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.groupStageService.generateRoundRobinMatches(tournamentId, eventId);
  }

  @Get('standings')
  @ApiOperation({
    summary: 'Get group standings',
    description: 'Alias for /groups to retrieve standings details.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'eventId', type: Number })
  @ApiResponse({ status: 200, type: [GroupStageGroupResponseDto] })
  getStandings(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.groupStageService.getStandings(tournamentId, eventId);
  }

  @Post('advance')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Advance top teams to knockout stage',
    description: 'Locks advanced teams from group stages and registers/seeds them for the knockout bracket.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'eventId', type: Number })
  @ApiResponse({ status: 200, description: 'Teams advanced successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  advance(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.groupStageService.advanceFromGroups(tournamentId, eventId);
  }
}
