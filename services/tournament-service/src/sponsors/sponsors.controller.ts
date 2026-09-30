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
import { SponsorsService } from './sponsors.service';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { SponsorResponseDto } from './dto/sponsor-response.dto';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TournamentOrganizerGuard } from '../guards/tournament-organizer.guard';

@ApiTags('Tournament Sponsors')
@Controller(':tournamentId/sponsors')
export class SponsorsController {
  constructor(private readonly sponsorsService: SponsorsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Add a new sponsor to a tournament',
    description: 'Enables tournament organizers to add a new sponsor and specify their sponsorship amount.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the tournament' })
  @ApiResponse({ status: 201, description: 'Sponsor added successfully.', type: SponsorResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  create(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() createDto: CreateSponsorDto,
  ) {
    return this.sponsorsService.create(tournamentId, createDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all sponsors for a tournament',
    description: 'Retrieves the list of all sponsors associated with the specified tournament.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the tournament' })
  @ApiResponse({ status: 200, description: 'List of sponsors retrieved successfully.', type: [SponsorResponseDto] })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  findAll(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return this.sponsorsService.findAll(tournamentId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get details of a specific sponsor',
    description: 'Returns the full details of a specific sponsor by its ID in this tournament.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the tournament' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the sponsor' })
  @ApiResponse({ status: 200, description: 'Sponsor details retrieved successfully.', type: SponsorResponseDto })
  @ApiResponse({ status: 404, description: 'Sponsor or Tournament not found.' })
  findOne(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.sponsorsService.findOne(tournamentId, id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update sponsor information',
    description: 'Updates details of an existing sponsor (like name, logo URL, or sponsorship amount).',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the tournament' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the sponsor to update' })
  @ApiResponse({ status: 200, description: 'Sponsor information updated successfully.', type: SponsorResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Sponsor or Tournament not found.' })
  update(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateSponsorDto,
  ) {
    return this.sponsorsService.update(tournamentId, id, updateDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Remove a sponsor from a tournament',
    description: 'Deletes the sponsor record from the specified tournament.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The unique ID of the tournament' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the sponsor to delete' })
  @ApiResponse({ status: 200, description: 'Sponsor deleted successfully.', type: SponsorResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Sponsor or Tournament not found.' })
  remove(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.sponsorsService.remove(tournamentId, id);
  }
}
