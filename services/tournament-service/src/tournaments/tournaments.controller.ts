import { Controller, Get, Post, Body, Patch, Param, Put, Query, ParseIntPipe, Delete, DefaultValuePipe, UseGuards, Req, Res } from '@nestjs/common';
import * as express from 'express';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { UpdateTournamentStatusDto } from './dto/update-tournament-status.dto';
import { TournamentStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TournamentOrganizerGuard } from '../guards/tournament-organizer.guard';
import {
  TournamentResponseDto,
  PaginatedTournamentsResponseDto,
  TournamentDetailsResponseDto,
} from './dto/tournament-response.dto';
import { DiscoverTournamentsDto } from './dto/discover-tournaments.dto';

@ApiTags('Tournaments')
@Controller()
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new tournament', description: 'Creates a new tournament with basic details. Default status is draft.' })
  @ApiResponse({ status: 201, description: 'The tournament has been successfully created.', type: TournamentResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid tournament details provided.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  create(@Req() req: any, @Body() createTournamentDto: CreateTournamentDto): Promise<TournamentResponseDto> {
    const organizerId = req.user?.sub;
    return this.tournamentsService.create(createTournamentDto, organizerId);
  }

  @Get('my-tournaments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user\'s tournaments', description: 'Returns a list of tournaments organized by or participated by the current user.' })
  @ApiQuery({ name: 'role', required: false, enum: ['organizer', 'player'], description: 'Role to filter tournaments by (optional)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page (default: 10)' })
  @ApiResponse({ status: 200, description: 'List of tournaments retrieved successfully.', type: PaginatedTournamentsResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid query parameters or role filter.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  findMyTournaments(
    @Req() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('role') role?: string,
  ): Promise<PaginatedTournamentsResponseDto> {
    const userId = req.user?.sub;
    return this.tournamentsService.findMyTournaments(userId, role, page, limit);
  }

  @Get('discover')
  @ApiOperation({
    summary: 'Discover tournaments',
    description: `Returns a paginated list of tournaments personalized for the user if authenticated.
Scoring criteria (higher score = higher ranking):
1. **Favorite Sports Center Match (+200 pts)**: Tournament center is in the user's favorite list.
2. **Proximity / Location Match (up to +150 pts)**:
   - Distance <= 15 km: +150 pts
   - Distance <= 50 km: +100 pts
   - Distance <= 100 km: +50 pts
   - Text fallback (same city/area based on profile address): +150 pts
3. **Teammate Registration Activity (+100 pts)**: Past teammate/partner is registered for this tournament.
4. **Tournament Status Match (up to +100 pts)**:
   - status is 'open_registration': +100 pts
   - status is 'published': +50 pts
5. **Skill & Gender Compatibility Match (+80 pts)**: Tournament has an event category matching user rating (DUPR/self-rating) and gender policy.`
  })
  @ApiResponse({ status: 200, description: 'Tournaments discovered successfully.' })
  discover(@Req() req: any, @Query() query: DiscoverTournamentsDto) {
    const authHeader = req.headers?.authorization;
    return this.tournamentsService.discover(query, authHeader);
  }


  @Get()
  @ApiOperation({ summary: 'Get a list of tournaments', description: 'Returns a paginated list of tournaments. Can be filtered by status and search query.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items per page (default: 10)' })
  @ApiQuery({ name: 'status', required: false, enum: TournamentStatus, description: 'Filter tournaments by their current status' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search tournaments by name or venue' })
  @ApiResponse({ status: 200, description: 'List of tournaments retrieved successfully.', type: PaginatedTournamentsResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid query parameters, status filter, or search query.' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: TournamentStatus,
    @Query('search') search?: string,
  ): Promise<PaginatedTournamentsResponseDto> {
    return this.tournamentsService.findAll(page, Math.min(limit, 100), status, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tournament details', description: 'Returns the full details of a specific tournament by its ID, including its events.' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the tournament' })
  @ApiResponse({ status: 200, description: 'Tournament details retrieved successfully.', type: TournamentDetailsResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid tournament ID format.' })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<TournamentDetailsResponseDto> {
    return this.tournamentsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update tournament info', description: 'Updates the generic information of an existing tournament (like name, venue, dates).' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the tournament to update' })
  @ApiResponse({ status: 200, description: 'Tournament information updated successfully.', type: TournamentResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid update body, invalid dates, or attempting to update a completed tournament.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateTournamentDto: UpdateTournamentDto
  ): Promise<TournamentResponseDto> {
    return this.tournamentsService.update(id, updateTournamentDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change tournament status', description: 'Updates only the status of the tournament according to its lifecycle (e.g., from draft to published).' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the tournament' })
  @ApiResponse({ status: 200, description: 'Tournament status updated successfully.', type: TournamentResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid status transition.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateTournamentStatusDto: UpdateTournamentStatusDto
  ): Promise<TournamentResponseDto> {
    return this.tournamentsService.updateStatus(id, updateTournamentStatusDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a tournament', description: 'Deletes a tournament by its unique ID. Only draft or published tournaments can be deleted.' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the tournament to delete' })
  @ApiResponse({ status: 200, description: 'Tournament deleted successfully.', type: TournamentResponseDto })
  @ApiResponse({ status: 400, description: 'Tournament cannot be deleted (e.g. it is in_progress or completed).' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<TournamentResponseDto> {
    return this.tournamentsService.remove(id);
  }

  @Get(':id/audit-logs')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get tournament audit logs', description: 'Returns a list of audit logs for a specific tournament.' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the tournament' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  findAuditLogs(@Param('id', ParseIntPipe) id: number) {
    return this.tournamentsService.findAuditLogs(id);
  }

  @Get(':id/share-link')
  @ApiOperation({ summary: 'Get tournament referral share link', description: 'Returns the standardized registration share link with UTM tracking parameters.' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the tournament' })
  @ApiQuery({ name: 'source', required: false, type: String, description: 'Referral source (default: user_share)' })
  @ApiQuery({ name: 'medium', required: false, type: String, description: 'Referral medium (default: native_share)' })
  @ApiResponse({ status: 200, description: 'Referral URL returned successfully' })
  async getShareLink(
    @Param('id', ParseIntPipe) id: number,
    @Query('source') source?: string,
    @Query('medium') medium?: string,
  ) {
    return this.tournamentsService.getShareLink(id, source, medium);
  }

  @Get(':id/poster')
  @ApiOperation({ summary: 'Get tournament dynamic poster', description: 'Returns the dynamically generated poster image buffer or redirects to Cloudinary if cached.' })
  @ApiParam({ name: 'id', type: Number, description: 'The unique ID of the tournament' })
  @ApiResponse({ status: 200, description: 'Direct image buffer (png)' })
  @ApiResponse({ status: 302, description: 'Redirect to Cloudinary cached image URL' })
  @ApiResponse({ status: 403, description: 'Forbidden if tournament is in draft status' })
  @ApiResponse({ status: 404, description: 'Tournament not found' })
  async getPoster(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: express.Response,
  ) {
    const result = await this.tournamentsService.getPoster(id);
    if (result.type === 'redirect') {
      return res.redirect(302, result.url);
    } else {
      res.setHeader('Content-Type', 'image/png');
      return res.send(result.buffer);
    }
  }
}
