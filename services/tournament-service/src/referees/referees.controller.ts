import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { RefereesService } from './referees.service';
import { AssignRefereeDto } from './dto/assign-referee.dto';
import { InviteRefereeDto } from './dto/invite-referee.dto';
import { BulkAssignRefereeDto } from './dto/bulk-assign-referee.dto';
import { RefereeAssignmentsQueryDto } from './dto/referee-assignments-query.dto';
import { RefereeListResponseDto } from './dto/referee-list-response.dto';
import { MatchRefereeAssignmentResponseDto, MyAssignmentsResponseDto } from './dto/referee-response.dto';
import {
  RefereeInvitationItemDto,
  AcceptInvitationResponseDto,
  JoinTournamentResponseDto,
  InviteRefereeResponseDto,
  RevokeInvitationResponseDto,
} from './dto/referee-invitation-response.dto';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TournamentOrganizerGuard } from '../guards/tournament-organizer.guard';
import { InternalTokenGuard } from '../guards/internal-token.guard';

@ApiTags('Tournament Referees')
@Controller(':tournamentId')
export class RefereesController {
  constructor(private readonly refereesService: RefereesService) {}


  @Delete('referees/:refereeId')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Remove/unenroll a referee from the tournament roster',
    description: 'Unregisters a referee from the tournament roster. Fails if they have active assignments.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'refereeId', type: String })
  @ApiResponse({ status: 200, description: 'Referee unenrolled successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  unenrollReferee(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('refereeId') refereeId: string,
  ) {
    return this.refereesService.unenrollReferee(tournamentId, refereeId);
  }

  @Get('referees')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List all enrolled referees and their workloads',
    description: 'Returns the roster of referees enrolled in this tournament, including match assignment counts.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiResponse({ status: 200, type: [RefereeListResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  listReferees(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
  ) {
    return this.refereesService.listEnrolledReferees(tournamentId);
  }

  @Post('matches/:matchId/assign')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Assign a referee to a match',
    description: 'Enables tournament organizers to assign a specific referee to oversee a match.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiParam({ name: 'matchId', type: Number, description: 'The unique match ID' })
  @ApiResponse({ status: 200, description: 'Referee assigned successfully.', type: MatchRefereeAssignmentResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Match not found.' })
  assignReferee(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('matchId', ParseIntPipe) matchId: number,
    @Body() assignDto: AssignRefereeDto,
    @Req() req: any,
  ) {
    return this.refereesService.assignReferee(tournamentId, matchId, assignDto.refereeId, req.headers?.authorization);
  }

  @Post('referees/bulk-assign')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Bulk assign a referee to multiple matches',
    description: 'Assigns an enrolled referee to a collection of matches in a single operation.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiResponse({ status: 200, description: 'Bulk assignment complete.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  bulkAssign(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() dto: BulkAssignRefereeDto,
    @Req() req: any,
  ) {
    return this.refereesService.bulkAssignReferee(tournamentId, dto, req.headers?.authorization);
  }

  @Delete('matches/:matchId/unassign')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Unassign referee from a match',
    description: 'Removes the assigned referee from a match.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiParam({ name: 'matchId', type: Number, description: 'The unique match ID' })
  @ApiResponse({ status: 200, description: 'Referee unassigned successfully.', type: MatchRefereeAssignmentResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Match not found.' })
  unassignReferee(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('matchId', ParseIntPipe) matchId: number,
    @Req() req: any,
  ) {
    return this.refereesService.unassignReferee(tournamentId, matchId, req.headers?.authorization);
  }

  @Get('referees/assignments')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List all matches and their referee assignments',
    description: 'Retrieves all matches in the tournament with referee information, optionally filtered by event.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiResponse({ status: 200, type: [MatchRefereeAssignmentResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  listAssignments(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Query() query: RefereeAssignmentsQueryDto,
  ) {
    return this.refereesService.listAllMatchesWithReferees(tournamentId, query.eventId);
  }

  @Get('referees/unassigned-matches')
  @UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List all unassigned matches',
    description: 'Retrieves all matches in the tournament that do not have a referee assigned.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiResponse({ status: 200, type: [MatchRefereeAssignmentResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: You are not the organizer of this tournament.' })
  listUnassigned(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Query() query: RefereeAssignmentsQueryDto,
  ) {
    return this.refereesService.listUnassignedMatches(tournamentId, query.eventId);
  }

  @Get('referees/my-assignments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get logged-in referee assignments',
    description: 'Retrieves all matches assigned to the currently logged-in referee in this tournament.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'The parent tournament ID' })
  @ApiResponse({ status: 200, description: 'Referee assignments retrieved.', type: MyAssignmentsResponseDto })
  getMyAssignments(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Req() req: any,
  ) {
    const refereeId = req.user?.sub;
    return this.refereesService.getMyAssignments(refereeId, tournamentId);
  }
}

@ApiTags('internal')
@Controller('internal/referees')
@UseGuards(InternalTokenGuard)
@ApiSecurity('internal-service-token')
export class RefereesInternalController {
  constructor(private readonly refereesService: RefereesService) {}

  @Get('invitations/:token')
  @ApiOperation({ summary: '[Internal] Get referee invitation metadata by token' })
  getInvitationByToken(@Param('token') token: string) {
    return this.refereesService.getInvitationByTokenInternal(token);
  }

  @Post('invitations/:token/accept')
  @ApiOperation({ summary: '[Internal] Accept referee invitation for a user' })
  acceptInvitation(
    @Param('token') token: string,
    @Body() body: { userId: string },
  ) {
    return this.refereesService.acceptInvitationInternal(token, body.userId);
  }
}

@ApiTags('Tournament Referee Invitations')
@Controller(':tournamentId')
@UseGuards(JwtAuthGuard, TournamentOrganizerGuard)
@ApiBearerAuth('access-token')
export class RefereesInvitationManageController {
  constructor(private readonly refereesService: RefereesService) {}

  @Post('referees/invitations')
  @ApiOperation({
    summary: 'Send a referee invitation',
    description: 'Sends an invite email to the given address. If the person already has an account, they also get an in-app notification.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'Tournament ID' })
  @ApiResponse({ status: 201, description: 'Invitation sent.', type: InviteRefereeResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid email, or an invitation was already sent to this email in the last 5 minutes.' })
  @ApiResponse({ status: 403, description: 'You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  inviteReferee(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() dto: InviteRefereeDto,
  ) {
    return this.refereesService.inviteReferee(tournamentId, dto.email);
  }

  @Get('referees/invitations')
  @ApiOperation({
    summary: 'List referee invitations',
    description: 'Returns all invitations for this tournament, newest first. Status values: PENDING, ACCEPTED, REVOKED.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'Tournament ID' })
  @ApiResponse({ status: 200, description: 'List of invitations.', type: [RefereeInvitationItemDto] })
  @ApiResponse({ status: 403, description: 'You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  listInvitations(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
  ) {
    return this.refereesService.listInvitations(tournamentId);
  }

  @Delete('referees/invitations/:id')
  @ApiOperation({
    summary: 'Revoke a referee invitation',
    description: 'Marks the invitation as REVOKED. If the person has already accepted, they remain in the referee list.',
  })
  @ApiParam({ name: 'tournamentId', type: Number, description: 'Tournament ID' })
  @ApiParam({ name: 'id', type: Number, description: 'Invitation ID (from the list endpoint)' })
  @ApiResponse({ status: 200, description: 'Invitation revoked.', type: RevokeInvitationResponseDto })
  @ApiResponse({ status: 400, description: 'This invitation has already been revoked.' })
  @ApiResponse({ status: 403, description: 'You are not the organizer of this tournament.' })
  @ApiResponse({ status: 404, description: 'Invitation not found.' })
  revokeInvitation(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.refereesService.revokeInvitation(tournamentId, id);
  }
}

@ApiTags('Tournament Referee Invitations')
@Controller('referees/invitations')
export class RefereesInvitationController {
  constructor(private readonly refereesService: RefereesService) {}

  @Get(':token')
  @ApiOperation({
    summary: 'Get referee invitation metadata by token (Public)',
    description: 'Allows Frontend to fetch invitation details using the token directly, without authentication.',
  })
  @ApiParam({ name: 'token', description: 'Invitation token' })
  @ApiResponse({ status: 200, description: 'Invitation metadata.' })
  async getInvitation(
    @Param('token') token: string,
  ) {
    return this.refereesService.getInvitationByTokenInternal(token);
  }

  @Post(':token/accept')
  @ApiOperation({
    summary: 'Accept a referee invitation',
    description: 'Handles the invite link from email. Behavior depends on account status:\n\n- No account yet → auto-creates account, logs in, and joins the tournament *(201)*\n- Has an account, not logged in → auto-logs in and joins the tournament *(200)*\n- Already logged in → joins the tournament immediately *(200)*',
  })
  @ApiParam({ name: 'token', description: 'Token from the invite email link' })
  @ApiResponse({ status: 201, description: 'New account created, logged in, and joined the tournament.', type: AcceptInvitationResponseDto })
  @ApiResponse({ status: 200, description: 'Logged into existing account and joined the tournament.', type: AcceptInvitationResponseDto })
  @ApiResponse({ status: 400, description: 'Token has already been used.' })
  @ApiResponse({ status: 403, description: 'Logged-in account does not match the invited email.' })
  @ApiResponse({ status: 404, description: 'Invitation not found.' })
  @ApiResponse({ status: 410, description: 'Invitation has expired.' })
  async acceptInvitation(
    @Param('token') token: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const authHeader = req.headers?.authorization;
    return this.refereesService.proxyAcceptInvitation(token, body, authHeader);
  }

  @Post(':token/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Join tournament as referee after login',
    description: 'Used when the user logs in manually after clicking the invite link. Requires a valid JWT. The logged-in email must match the invited email.',
  })
  @ApiParam({ name: 'token', description: 'Token from the invite email link' })
  @ApiResponse({ status: 200, description: 'Joined the tournament as referee.', type: JoinTournamentResponseDto })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT.' })
  @ApiResponse({ status: 403, description: 'Logged-in account does not match the invited email.' })
  @ApiResponse({ status: 404, description: 'Invitation not found.' })
  @ApiResponse({ status: 409, description: 'Already a referee in this tournament.' })
  async joinTournament(
    @Param('token') token: string,
    @Req() req: any,
  ) {
    return this.refereesService.proxyJoinTournament(token, req.headers?.authorization);
  }
}
