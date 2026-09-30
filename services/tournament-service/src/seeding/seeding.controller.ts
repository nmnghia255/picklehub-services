import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TournamentOrganizerGuard } from '../guards/tournament-organizer.guard';
import { SeedingService } from './seeding.service';
import { ReorderSeedsDto } from './dto/reorder-seeds.dto';
import { SeedListResponseDto } from './dto/seed-response.dto';

@ApiTags('Tournament Seeding')
@Controller(':tournamentId/events/:eventId/seeds')
export class SeedingController {
  constructor(private readonly seedingService: SeedingService) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Generate seeds for an event',
    description: "Ranks the event's approved teams by rating (descending) and writes the seed order as unlocked. Blocked once seeding is locked.",
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The unique ID of the event category' })
  @ApiResponse({ status: 201, description: 'Seeds generated successfully.', type: SeedListResponseDto })
  @ApiResponse({ status: 400, description: 'No teams to seed, or seeding already locked.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament or event not found.' })
  generate(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<SeedListResponseDto> {
    return this.seedingService.generate(tournamentId, eventId);
  }

  @Get()
  @ApiOperation({
    summary: 'List seeds for an event',
    description: 'Returns the current seed order for the event.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The unique ID of the event category' })
  @ApiResponse({ status: 200, description: 'Seed list retrieved successfully.', type: SeedListResponseDto })
  @ApiResponse({ status: 404, description: 'Tournament or event not found.' })
  list(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<SeedListResponseDto> {
    return this.seedingService.list(tournamentId, eventId);
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Reorder seeds (batch)',
    description: 'Applies a full new seed ordering in one request (e.g. after a drag-and-drop). The payload must include every seed exactly once. Blocked once seeding is locked.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The unique ID of the event category' })
  @ApiResponse({ status: 200, description: 'Seeds reordered successfully.', type: SeedListResponseDto })
  @ApiResponse({ status: 400, description: 'Incomplete/invalid ordering, or seeding locked.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament or event not found.' })
  reorder(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: ReorderSeedsDto,
  ): Promise<SeedListResponseDto> {
    return this.seedingService.reorder(tournamentId, eventId, dto);
  }

  @Post('lock')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Lock the seeding',
    description: 'Locks the seed order so the bracket can be built from a fixed order. After locking, generate/reorder are blocked.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The unique ID of the event category' })
  @ApiResponse({ status: 201, description: 'Seeding locked successfully.', type: SeedListResponseDto })
  @ApiResponse({ status: 400, description: 'No seeds to lock.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament or event not found.' })
  lock(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<SeedListResponseDto> {
    return this.seedingService.lock(tournamentId, eventId);
  }
}
