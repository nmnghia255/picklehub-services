import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { GetBookedSlotsQueryDto } from './dto/get-booked-slots-query.dto';

/** Shape of an enriched booking row (mirror + live sport-center status/items + linked fixtures). */
const BOOKING_LIST_EXAMPLE = {
  data: [
    {
      id: 5,
      externalBookingId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
      date: '2026-06-20',
      statusMirror: 'CONFIRMED',
      liveStatus: 'CONFIRMED',
      totalPrice: 200000,
      items: [
        {
          id: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
          courtId: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
          startTime: '17:00',
          endTime: '19:00',
          court: { id: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972', name: 'San 1' },
        },
      ],
      fixtures: [{ id: 12, bookingId: 5, bookingItemId: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f', round: 'Semifinal' }],
    },
  ],
  meta: { total: 1 },
};

@ApiTags('Tournament Bookings')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller(':tournamentId/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create court bookings (single or multi-day)',
    description: 'Books court slots across one or more dates in a single action and registers their local mirrors.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Bookings created. Returns the array of local mirrors plus the live sport-center payloads.',
    content: {
      'application/json': {
        example: [
          {
            booking: {
              id: 5,
              tournamentId: 1,
              externalBookingId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
              centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
              date: '2026-06-20',
              statusMirror: 'PENDING',
              totalPrice: 200000,
              createdAt: '2026-06-19T10:15:00.000Z',
              updatedAt: '2026-06-19T10:15:00.000Z',
            },
            sportCenter: {
              id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
              status: 'PENDING',
              totalPrice: 200000,
              bookingItems: [
                { id: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f', courtId: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972', startTime: '17:00', endTime: '19:00' },
              ],
              expiresAt: '2026-06-19T10:25:00.000Z',
            },
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Center not selected, or booking failed in sport-center.' })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  create(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() dto: CreateBookingDto,
    @Req() req: any,
  ) {
    return this.bookingsService.createBooking(tournamentId, dto, req.headers?.authorization);
  }

  @Get()
  @ApiOperation({
    summary: 'List bookings',
    description: 'Lists the tournament bookings with live status/items from sport-center and the fixtures linked to each.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Bookings retrieved, each enriched with live status/items and its linked fixtures.',
    content: { 'application/json': { example: BOOKING_LIST_EXAMPLE } },
  })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  list(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return this.bookingsService.listBookings(tournamentId);
  }

  @Get('items')
  @ApiOperation({
    summary: 'List tournament booking items',
    description: 'Lists all booking items (court slots) reserved for the tournament with their current match assignments.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Booking items list retrieved successfully.',
  })
  listItems(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return this.bookingsService.listBookingItems(tournamentId);
  }

  @Get('booked-slots')
  @ApiOperation({
    summary: 'Get booked slots of tournament',
    description: 'Get all booked slots (booking items) of a tournament filtered by centerId and date.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiQuery({ name: 'centerId', type: String, required: true })
  @ApiQuery({ name: 'date', type: String, required: true, description: 'Format YYYY-MM-DD' })
  @ApiResponse({ status: 200, description: 'Booked slots retrieved successfully.' })
  getBookedSlots(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Query() query: GetBookedSlotsQueryDto,
  ) {
    return this.bookingsService.getBookedSlots(tournamentId, query.centerId, query.date);
  }

  @Post('sync')
  @ApiOperation({
    summary: 'Sync booking statuses',
    description: 'Refreshes each mirror status from sport-center (PENDING → CONFIRMED / EXPIRED / CANCELLED).',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Mirror statuses refreshed; returns the bookings list (same shape as GET).',
    content: { 'application/json': { example: BOOKING_LIST_EXAMPLE } },
  })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  sync(@Param('tournamentId', ParseIntPipe) tournamentId: number) {
    return this.bookingsService.syncBookings(tournamentId);
  }

  @Delete(':bookingId')
  @ApiOperation({
    summary: 'Cancel a booking',
    description: 'Cancels the booking in sport-center and unlinks any fixtures using it.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiParam({ name: 'bookingId', type: Number, description: 'Local tournament booking id' })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled (its fixtures unlinked); returns the updated local mirror.',
    content: {
      'application/json': {
        example: {
          id: 5,
          tournamentId: 1,
          externalBookingId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
          centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
          date: '2026-06-20',
          statusMirror: 'CANCELLED',
          totalPrice: 200000,
          createdAt: '2026-06-19T10:15:00.000Z',
          updatedAt: '2026-06-19T10:40:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Cancellation not allowed in sport-center.' })
  @ApiResponse({ status: 404, description: 'Tournament or booking not found.' })
  cancel(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Req() req: any,
  ) {
    return this.bookingsService.cancelBooking(tournamentId, bookingId, req.headers?.authorization);
  }
}
