import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TournamentOrganizerGuard } from '../guards/tournament-organizer.guard';

@ApiTags('Tournament Events')
@Controller(':tournamentId/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create a new event in a tournament',
    description: 'Creates a new match division/category (event) for a tournament (e.g. Doubles Mixed 4.0). Can only be created if the tournament is in draft or published status.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiResponse({ status: 201, description: 'The event category has been successfully created.', type: EventResponseDto })
  @ApiResponse({ status: 400, description: 'Tournament cannot accept new events (e.g. it is already active or completed).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  create(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() createEventDto: CreateEventDto,
  ) {
    return this.eventsService.create(tournamentId, createEventDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all event categories in a tournament',
    description: 'Returns all match event categories defined for a specific tournament.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiResponse({ status: 200, description: 'List of tournament events retrieved successfully.', type: [EventResponseDto] })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  findAll(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return this.eventsService.findAll(tournamentId);
  }

  @Get(':eventId')
  @ApiOperation({
    summary: 'Get details of a tournament event',
    description: 'Returns the full details of a specific event category by its ID within a tournament.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The unique ID of the event category' })
  @ApiResponse({ status: 200, description: 'Tournament event details retrieved successfully.', type: EventResponseDto })
  @ApiResponse({ status: 404, description: 'Tournament or event category not found.' })
  findOne(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.eventsService.findOne(tournamentId, eventId);
  }

  @Put(':eventId')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update event category information',
    description: 'Updates information such as capacity or entry fee of an event category. Only allowed if tournament is in draft or published status.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The unique ID of the event category to update' })
  @ApiResponse({ status: 200, description: 'Event category updated successfully.', type: EventResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid updates (e.g. capacity less than registered participants, or active tournament).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament or event category not found.' })
  update(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() updateEventDto: UpdateEventDto,
  ) {
    return this.eventsService.update(tournamentId, eventId, updateEventDto);
  }

  @Delete(':eventId')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Delete an event category',
    description: 'Deletes an event category from the tournament. Only allowed if tournament is in draft/published status and the event has no registered participants.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the parent tournament' })
  @ApiParam({ name: 'eventId', type: Number, description: 'The unique ID of the event category to delete' })
  @ApiResponse({ status: 200, description: 'Event category deleted successfully.', type: EventResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot delete event category (e.g. has active participants, or active tournament).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament or event category not found.' })
  remove(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.eventsService.remove(tournamentId, eventId);
  }
}
