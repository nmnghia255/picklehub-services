import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { PrizesService } from './prizes.service';
import { CreatePrizeDto } from './dto/create-prize.dto';
import { UpdatePrizeDto } from './dto/update-prize.dto';
import { PrizeResponseDto } from './dto/prize-response.dto';
import { AwardPrizeDto } from './dto/award-prize.dto';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TournamentOrganizerGuard } from '../guards/tournament-organizer.guard';

@ApiTags('Tournament Prizes')
@Controller(':tournamentId/prizes')
export class PrizesController {
  constructor(private readonly prizesService: PrizesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Add a new prize to a tournament',
    description: 'Enables tournament organizers to add a new prize tier, cash reward, or trophy for the tournament or specific event.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the tournament' })
  @ApiResponse({ status: 201, description: 'Prize created successfully.', type: PrizeResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament or Event not found.' })
  create(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() createDto: CreatePrizeDto,
  ) {
    return this.prizesService.create(tournamentId, createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all prizes for a tournament',
    description: 'Retrieves the list of all prizes associated with the specified tournament, optionally filtered by event.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the tournament' })
  @ApiQuery({ name: 'eventId', required: false, type: Number, description: 'Optional Event ID to filter prizes' })
  @ApiResponse({ status: 200, description: 'List of prizes retrieved successfully.', type: [PrizeResponseDto] })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  findAll(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Query('eventId') eventId?: number,
  ) {
    return this.prizesService.findAll(tournamentId, eventId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get details of a specific prize',
    description: 'Returns the details of a specific prize by its ID in this tournament.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the tournament' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the prize' })
  @ApiResponse({ status: 200, description: 'Prize details retrieved successfully.', type: PrizeResponseDto })
  @ApiResponse({ status: 404, description: 'Prize or Tournament not found.' })
  findOne(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.prizesService.findOne(tournamentId, id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update prize information',
    description: 'Updates details of an existing prize (like name, value, or event ID).',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the tournament' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the prize to update' })
  @ApiResponse({ status: 200, description: 'Prize information updated successfully.', type: PrizeResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Prize or Tournament not found.' })
  update(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdatePrizeDto,
  ) {
    return this.prizesService.update(tournamentId, id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Remove a prize from a tournament',
    description: 'Deletes the prize record from the specified tournament and cleans up any related financial transactions.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the tournament' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the prize to delete' })
  @ApiResponse({ status: 200, description: 'Prize deleted successfully.', type: PrizeResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Prize or Tournament not found.' })
  remove(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.prizesService.remove(tournamentId, id);
  }

  @Post(':id/award')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Award a prize to a team',
    description: 'Binds a prize to a specific winning Team (which represents a single player or doubles pair). For cash prizes, it transactionally creates or updates the associated financial transaction expense.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the tournament' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the prize' })
  @ApiResponse({ status: 200, description: 'Prize awarded successfully.', type: PrizeResponseDto })
  @ApiResponse({ status: 400, description: 'Bad Request.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Prize, Team, or Tournament not found.' })
  awardPrize(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() awardDto: AwardPrizeDto,
  ) {
    const winnerTeamId = awardDto.winnerTeamId !== undefined ? awardDto.winnerTeamId : null;
    return this.prizesService.awardPrize(tournamentId, id, winnerTeamId);
  }
}
