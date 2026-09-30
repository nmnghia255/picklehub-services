import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TournamentOrganizerGuard } from '../guards/tournament-organizer.guard';
import { BracketService } from './bracket.service';
import { BracketResponseDto } from './dto/bracket-response.dto';
import { EditBracketDto } from './dto/edit-bracket.dto';

@ApiTags('Tournament Bracket')
@Controller(':tournamentId/events/:eventId/bracket')
export class BracketController {
  constructor(private readonly bracketService: BracketService) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Generate the single-elimination bracket',
    description: 'Builds a seeded single-elimination bracket from the locked seeds (byes pad to the next power of two). Requires the tournament to be in_progress and the seeds locked.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The unique ID of the event category' })
  @ApiResponse({ status: 201, description: 'Bracket generated successfully.', type: BracketResponseDto })
  @ApiResponse({ status: 400, description: 'Seeds not locked, tournament not in progress, or a started bracket already exists.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament or event not found.' })
  generate(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<BracketResponseDto> {
    return this.bracketService.generate(tournamentId, eventId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get the bracket',
    description: 'Returns the bracket fixtures for the event, ordered by round then position.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The unique ID of the event category' })
  @ApiResponse({ status: 200, description: 'Bracket retrieved successfully.', type: BracketResponseDto })
  @ApiResponse({ status: 404, description: 'Tournament or event not found.' })
  get(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<BracketResponseDto> {
    return this.bracketService.getBracket(tournamentId, eventId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete the bracket',
    description: 'Removes the bracket so it can be regenerated. Blocked if any match has already started.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The unique ID of the event category' })
  @ApiResponse({ status: 200, description: 'Bracket deleted successfully.' })
  @ApiResponse({ status: 400, description: 'Cannot delete: some matches have already started, or no bracket exists.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament or event not found.' })
  remove(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<{ deleted: number }> {
    return this.bracketService.deleteBracket(tournamentId, eventId);
  }

  @Patch('edit')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Edit bracket matches',
    description: 'Allows swapping/assigning teams in matches before the bracket is locked.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The unique ID of the event category' })
  @ApiResponse({ status: 200, description: 'Bracket updated successfully.', type: BracketResponseDto })
  @ApiResponse({ status: 400, description: 'Bracket is locked, or validation failed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  edit(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: EditBracketDto,
  ): Promise<BracketResponseDto> {
    return this.bracketService.editBracket(tournamentId, eventId, dto);
  }

  @Post('lock')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Lock the bracket',
    description: 'Locks the bracket so no further edits, deletions, or regeneration are allowed.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The unique ID of the event category' })
  @ApiResponse({ status: 201, description: 'Bracket locked successfully.', type: BracketResponseDto })
  @ApiResponse({ status: 400, description: 'No bracket to lock.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  lock(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<BracketResponseDto> {
    return this.bracketService.lockBracket(tournamentId, eventId);
  }
}
