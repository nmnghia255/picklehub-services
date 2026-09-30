import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { CourtBookingService } from './court-booking.service';
import { LinkCourtBookingDto } from './dto/link-court-booking.dto';
import { ListCourtBookingsQueryDto } from './dto/list-court-bookings.query.dto';

type AuthRequest = Request & {
  user?: { userId: string; userName?: string; email?: string; roles?: string[] };
};

// ── Swagger example data ────────────────────────────────────────────────────

const sampleBookingItemsSnapshot = [
  {
    bookingId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    date: '2026-07-15',
    courtId: 'court-uuid-1',
    courtName: 'Sân 1',
    startTime: '08:00',
    endTime: '10:00',
  },
  {
    bookingId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    date: '2026-07-15',
    courtId: 'court-uuid-2',
    courtName: 'Sân 2',
    startTime: '08:00',
    endTime: '10:00',
  },
  // Same court, different non-contiguous window — kept as a separate row
  {
    bookingId: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
    date: '2026-07-15',
    courtId: 'court-uuid-1',
    courtName: 'Sân 1',
    startTime: '11:00',
    endTime: '12:00',
  },
];

const sampleRecord = {
  id: 'gcb-uuid-1111-2222-3333-444444444444',
  groupId: 'group-uuid-5555-6666-7777-888888888888',
  title: 'Saturday Morning Session',
  note: '3 courts booked — pay your share by Friday.',
  linkedById: 'owner-uuid-9999',
  bookingId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  centerId: 'center-uuid-aaaa',
  centerName: 'Pickle Dome Sukhumvit',
  centerAddress: '42 Sukhumvit 49, Watthana, Bangkok',
  totalBookingCost: 720000,
  date: '2026-07-15T00:00:00.000Z',
  startTime: '2026-07-15T01:00:00.000Z',  // 08:00 UTC+7
  endTime: '2026-07-15T05:00:00.000Z',    // 12:00 UTC+7
  bookingItemsSnapshot: sampleBookingItemsSnapshot,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
};

// ── Controller ──────────────────────────────────────────────────────────────

@ApiTags('Group Court Bookings')
@Controller('api/groups/:groupId/court-bookings')
@ApiBearerAuth('access-token')
export class CourtBookingController {
  constructor(private readonly courtBookingService: CourtBookingService) { }

  // --------------------------------------------------------------------------
  // POST /api/groups/:groupId/court-bookings  — link bookings (OWNER)
  // --------------------------------------------------------------------------

  @Post()
  @ApiOperation({
    summary: 'Link court bookings to a group (Owner)',
    description: 'Allows group owner to attach a court booking from sport-center-service to the group.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiBody({ type: LinkCourtBookingDto })
  @ApiResponse({
    status: 201,
    description: 'Court bookings linked successfully.',
    schema: {
      example: {
        message: 'Court bookings linked to group successfully',
        data: sampleRecord,
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid payload, bookings not found, wrong status (not CONFIRMED/COMPLETED), ' +
      'different centers, or different dates.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not the group OWNER, or bookings do not belong to caller.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  @ApiConflictResponse({ description: 'One or more bookings are already linked to this group.' })
  @HttpCode(HttpStatus.CREATED)
  link(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: LinkCourtBookingDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.courtBookingService.linkCourtBooking(userId, groupId, dto);
  }

  // --------------------------------------------------------------------------
  // DELETE /api/groups/:groupId/court-bookings/:id  — unlink (OWNER)
  // --------------------------------------------------------------------------

  @Delete(':id')
  @ApiOperation({
    summary: 'Unlink a court booking from a group (Owner)',
    description: 'Removes the court booking link record from the group (does not cancel the booking itself).',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiParam({ name: 'id', description: 'GroupCourtBooking id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Court booking unlinked successfully.',
    schema: {
      example: { message: 'Court booking unlinked from group successfully' },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not the group OWNER.' })
  @ApiNotFoundResponse({ description: 'Group or court booking link not found.' })
  @HttpCode(HttpStatus.OK)
  unlink(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.courtBookingService.unlinkCourtBooking(userId, groupId, id);
  }

  // --------------------------------------------------------------------------
  // GET /api/groups/:groupId/court-bookings  — list (any MEMBER)
  // --------------------------------------------------------------------------

  @Get()
  @ApiOperation({
    summary: 'List court bookings linked to a group (Owner/Member)',
    description: 'Returns a paginated list of all court bookings linked to the group. Use `?linked=false` to get bookings not yet associated with any activity (for activity linking UI), or `?linked=true` to get only bookings already linked.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'List returned successfully.',
    schema: {
      example: {
        message: 'List group court bookings successfully',
        data: [{
          ...sampleRecord,
          linkedActivity: {
            id: 'activity-uuid-1111',
            title: 'Buổi tập sáng thứ 7',
            status: 'SCHEDULED',
            startAt: '2026-07-15T01:00:00.000Z',
            endAt: '2026-07-15T05:00:00.000Z',
          },
        }],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not a group member.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  @HttpCode(HttpStatus.OK)
  list(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: ListCourtBookingsQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.courtBookingService.listCourtBookings(userId, groupId, query);
  }

  // --------------------------------------------------------------------------
  // GET /api/groups/:groupId/court-bookings/:id  — detail (any MEMBER)
  // --------------------------------------------------------------------------

  @Get(':id')
  @ApiOperation({
    summary: 'Get single court booking link details with live status (Owner/Member)',
    description: 'Returns detail of a group court booking. Includes `linkedActivity` (the single activity linked to this booking, or null) and live status fetched from sport-center-service.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiParam({ name: 'id', description: 'GroupCourtBooking id (UUID).' })
  @ApiResponse({
    status: 200,
    description: 'Detail fetched successfully.',
    schema: {
      example: {
        message: 'Group court booking fetched successfully',
        data: {
          ...sampleRecord,
          linkedActivity: {
            id: 'activity-uuid-1111',
            title: 'Buổi tập sáng thứ 7',
            status: 'SCHEDULED',
            startAt: '2026-07-15T01:00:00.000Z',
            endAt: '2026-07-15T05:00:00.000Z',
          },
          liveBookingDetails: [
            {
              bookingId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
              status: 'CONFIRMED',
              totalPrice: 480000,
            },
          ],
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiForbiddenResponse({ description: 'Caller is not a group member.' })
  @ApiNotFoundResponse({ description: 'Group or court booking link not found.' })
  @HttpCode(HttpStatus.OK)
  detail(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.courtBookingService.getCourtBookingDetail(userId, groupId, id);
  }

  @Get(':bookingId/cancel-eligibility')
  @ApiOperation({
    summary: 'Query cancellation policy and refund eligibility (Owner)',
    description: 'Queries sport-center-service cancellation policy and matches against current time.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiParam({ name: 'bookingId', description: 'GroupCourtBooking id (UUID).' })
  @ApiResponse({ status: 200, description: 'Eligibility and warning retrieved successfully.' })
  @ApiForbiddenResponse({ description: 'Caller is not the group OWNER.' })
  @HttpCode(HttpStatus.OK)
  cancelEligibility(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.courtBookingService.checkCancelEligibility(userId, groupId, bookingId);
  }

  @Post(':bookingId/cancel')
  @ApiOperation({
    summary: 'Cancel linked court booking (Owner)',
    description: 'Cancels booking in sport-center-service, refunds to wallet, and flags group activities as CANCELLED.',
  })
  @ApiParam({ name: 'groupId', description: 'Group id (UUID).' })
  @ApiParam({ name: 'bookingId', description: 'GroupCourtBooking id (UUID).' })
  @ApiResponse({ status: 200, description: 'Booking and group activities cancelled successfully.' })
  @ApiForbiddenResponse({ description: 'Caller is not the group OWNER.' })
  @HttpCode(HttpStatus.OK)
  cancel(
    @Request() req: AuthRequest,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Unable to identify current user');
    return this.courtBookingService.cancelBooking(userId, groupId, bookingId);
  }
}
