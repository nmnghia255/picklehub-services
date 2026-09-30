import {
  Controller,
  Post,
  Patch,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { SessionAttendanceService } from './session-attendance.service';
import { RequestGuestDto } from './dto/request-guest.dto';
import { ReviewGuestDto } from './dto/review-guest.dto';

type AuthRequest = Request & {
  user?: {
    userId: string;
    userName?: string;
    email?: string;
    roles?: string[];
  };
};

@ApiTags('Group Session Attendance')
@Controller('api/groups/:groupId/activities/:activityId/attendance')
@ApiBearerAuth('access-token')
export class SessionAttendanceController {
  constructor(private readonly attendanceService: SessionAttendanceService) { }

  // ─── Absence endpoints ────────────────────────────────────────────────────

  // ─── Absence endpoints ────────────────────────────────────────────────────

  @Post('absence')
  @ApiOperation({ summary: 'Report absence (Member)', description: 'Member reports they will not attend a session. Must be submitted before the cancellation deadline. Automatically resets any approved guest requests.' })
  @ApiParam({ name: 'groupId', description: 'Group ID (UUID)' })
  @ApiParam({ name: 'activityId', description: 'Activity/Session ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Absence reported successfully' })
  @ApiResponse({ status: 400, description: 'Past cancellation deadline cutoff' })
  @ApiResponse({ status: 403, description: 'Forbidden: Not a member of the group' })
  @HttpCode(HttpStatus.OK)
  async reportAbsence(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    const data = await this.attendanceService.reportAbsence(groupId, activityId, userId);
    return {
      message: 'Absence reported successfully. Approved guests (if any) have been cancelled.',
      data: {
        activityId: data.activityId,
        memberId: data.memberId,
        status: data.status,
        guestCount: data.guestCount,
        guestStatus: data.guestStatus,
      },
    };
  }

  @Delete('absence')
  @ApiOperation({
    summary: 'Cancel absence report (Member or Owner)',
    description: 'Reverts member attendance status back to ATTENDING. Only allowed before the cancellation deadline and before the session has started, unless caller is OWNER.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID (UUID)' })
  @ApiParam({ name: 'activityId', description: 'Activity/Session ID (UUID)' })
  @ApiQuery({ name: 'memberId', required: false, description: 'Member ID (UUID) whose absence to cancel (OWNER only).' })
  @ApiResponse({
    status: 200,
    description: 'Absence report cancelled successfully',
    content: {
      'application/json': {
        example: {
          message: 'Attendance restored to Attending.',
          data: {
            activityId: 'a0000001-a000-4000-8000-000000000001',
            memberId: 'target-member-uuid',
            status: 'ATTENDING',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cannot change attendance once the session has started' })
  @ApiResponse({ status: 403, description: 'Forbidden: Not a member of the group or not OWNER if canceling other member\'s absence' })
  @HttpCode(HttpStatus.OK)
  async cancelAbsence(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Query('memberId') memberId?: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    const data = await this.attendanceService.cancelAbsence(groupId, activityId, userId, memberId);
    return {
      message: 'Attendance restored to Attending.',
      data: {
        activityId: data.activityId,
        memberId: data.memberId,
        status: data.status,
      },
    };
  }

  // ─── Guest request endpoints ──────────────────────────────────────────────

  /**
   * GET /attendance/guests?status=PENDING|APPROVED|REJECTED
   * List all guest requests for a session activity with optional status filter.
   * Accessible by any group member, but primarily intended for host use.
   */
  @Get('guests')
  @ApiOperation({
    summary: 'List guest requests for a session (Owner/Member)',
    description: 'Returns all members who have submitted guest requests for this session. Filter by ?status=PENDING|APPROVED|REJECTED|REVISION. Shows pendingGuestCount when a draft revision exists.',
  })
  @ApiParam({ name: 'groupId', description: 'Group ID (UUID)' })
  @ApiParam({ name: 'activityId', description: 'Activity/Session ID (UUID)' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'REVISION'],
    description: 'Filter by guestStatus or pending revisions. Omit to return all requests (guestCount > 0 or has pending revision).',
  })
  @ApiResponse({
    status: 200,
    description: 'List of guest requests returned successfully',
    content: {
      'application/json': {
        example: {
          message: 'Guest requests fetched successfully.',
          data: [
            {
              memberId: 'member-uuid-11111',
              userId: 'user-uuid-22222',
              role: 'MEMBER',
              name: 'John Doe',
              email: 'johndoe@picklehub.com',
              avatarUrl: 'http://example.com/avatar.png',
              guestCount: 2,
              guestStatus: 'APPROVED',
              pendingGuestCount: 3,
              reportedAt: '2026-07-12T10:00:00.000Z',
              requester: {
                id: 'user-uuid-22222',
                name: 'John Doe',
                email: 'johndoe@picklehub.com',
                avatarUrl: 'http://example.com/avatar.png',
              },
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden: Not a member of the group' })
  async listGuestRequests(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION',
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    const data = await this.attendanceService.listGuestRequests(groupId, activityId, userId, status);
    return {
      message: 'Guest requests fetched successfully.',
      data,
    };
  }

  /**
   * POST /attendance/guests
   * Member submits (or re-submits) a guest count request for a session.
   * Rules: guestCount >= 1; cannot modify if guestStatus is already APPROVED.
   */
  @Post('guests')
  @ApiOperation({ summary: 'Request guest count (Member)', description: 'Member registers a number of guests (≥1) to bring. If an APPROVED request already exists, the new count is saved as pendingGuestCount (draft) pending host review.' })
  @ApiParam({ name: 'groupId', description: 'Group ID (UUID)' })
  @ApiParam({ name: 'activityId', description: 'Activity/Session ID (UUID)' })
  @ApiBody({ type: RequestGuestDto })
  @ApiResponse({ status: 200, description: 'Guest request recorded successfully' })
  @ApiResponse({ status: 400, description: 'guestCount must be >= 1 or request already APPROVED' })
  @HttpCode(HttpStatus.OK)
  async requestGuests(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() dto: RequestGuestDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    const data = await this.attendanceService.requestGuests(groupId, activityId, userId, dto);
    return {
      message: 'Guest count request submitted successfully.',
      data: {
        activityId: data.activityId,
        memberId: data.memberId,
        guestCount: data.guestCount,
        guestStatus: data.guestStatus,
        pendingGuestCount: data.pendingGuestCount ?? null,
      },
    };
  }

  /**
   * PATCH /attendance/:memberId/guests/status
   * Host (OWNER only) approves or rejects a member's guest request.
   */
  @Patch(':memberId/guests/status')
  @ApiOperation({ summary: 'Approve or reject guest request (Owner)', description: 'Host approves or rejects a member guest request. When approving a draft (pendingGuestCount), the official guestCount is updated and the draft is cleared.' })
  @ApiParam({ name: 'groupId', description: 'Group ID (UUID)' })
  @ApiParam({ name: 'activityId', description: 'Activity/Session ID (UUID)' })
  @ApiParam({ name: 'memberId', description: "Member ID (UUID) of the member whose guests to review" })
  @ApiBody({ type: ReviewGuestDto })
  @ApiResponse({ status: 200, description: 'Guest request reviewed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: Only OWNER can review guest requests' })
  @HttpCode(HttpStatus.OK)
  async reviewGuests(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: ReviewGuestDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    const data = await this.attendanceService.reviewGuests(groupId, activityId, memberId, userId, dto);
    return {
      message: `Guest request status successfully updated to ${dto.status}.`,
      data: {
        activityId: data.activityId,
        memberId: data.memberId,
        guestCount: data.guestCount,
        guestStatus: data.guestStatus,
        pendingGuestCount: data.pendingGuestCount ?? null,
      },
    };
  }

  /**
   * DELETE /attendance/:memberId/guests
   * Host (OWNER only) cancels a member's guest request entirely,
   * resetting guestCount to 0 and guestStatus to null.
   */
  @Delete(':memberId/guests')
  @ApiOperation({ summary: 'Cancel member guest request (Owner)', description: 'Host completely cancels a member\'s guest registration, resetting guestCount to 0 and guestStatus to null. A notification is sent to the affected member.' })
  @ApiParam({ name: 'groupId', description: 'Group ID (UUID)' })
  @ApiParam({ name: 'activityId', description: 'Activity/Session ID (UUID)' })
  @ApiParam({ name: 'memberId', description: "Member ID (UUID) of the member whose guests to cancel" })
  @ApiResponse({ status: 200, description: 'Guest request cancelled successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: Only OWNER can cancel guest requests' })
  @ApiResponse({ status: 404, description: 'Not Found: Activity or Attendance record not found' })
  @HttpCode(HttpStatus.OK)
  async cancelGuests(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    const data = await this.attendanceService.cancelGuests(groupId, activityId, memberId, userId);
    return {
      message: 'Guest request cancelled successfully by host.',
      data: {
        activityId: data.activityId,
        memberId: data.memberId,
        guestCount: data.guestCount,
        guestStatus: data.guestStatus,
        pendingGuestCount: data.pendingGuestCount ?? null,
      },
    };
  }
}
