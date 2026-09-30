import { Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CourtsService } from './courts.service';

@ApiTags('Tournament Courts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller(':tournamentId/courts')
export class CourtsController {
  constructor(private readonly courtsService: CourtsService) {}

  @Get('availability')
  @ApiOperation({
    summary: 'Court availability for a selected center',
    description: 'Proxies sport-center bulk 30-minute court availability for a selected center on a date. The center must be in the tournament selection.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiQuery({ name: 'centerId', type: String, description: 'A selected center id (uuid)' })
  @ApiQuery({ name: 'date', type: String, description: 'Date (YYYY-MM-DD)' })
  @ApiResponse({
    status: 200,
    description: 'Bulk court availability for the center on the date (proxied from sport-center).',
    content: {
      'application/json': {
        example: {
          date: '2026-06-20',
          centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
          courtCount: 2,
          courts: [
            {
              courtId: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
              courtName: 'San 1',
              slots: [
                { startTime: '17:00', endTime: '17:30', available: true, pricePerHour: 80000 },
                { startTime: '17:30', endTime: '18:00', available: false, pricePerHour: 80000 },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Center not selected, or missing date.' })
  @ApiResponse({ status: 404, description: 'Tournament not found, or availability unavailable.' })
  availability(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Query('centerId', new ParseUUIDPipe()) centerId: string,
    @Query('date') date: string,
    @Req() req: any,
  ) {
    return this.courtsService.getAvailability(tournamentId, centerId, date, req.headers?.authorization);
  }

  @Get('booked-slots')
  @ApiOperation({
    summary: 'Get booked slots of tournament',
    description: 'Get all booked slots (booking items) of a tournament filtered by centerId and date.',
  })
  @ApiParam({ name: 'tournamentId', type: Number })
  @ApiQuery({ name: 'centerId', type: String, description: 'A selected center id (uuid)' })
  @ApiQuery({ name: 'date', type: String, description: 'Date (YYYY-MM-DD)' })
  @ApiResponse({
    status: 200,
    description: 'Booked slots retrieved successfully.',
    content: {
      'application/json': {
        example: [
          {
            bookingId: 5,
            externalBookingId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
            bookingItemId: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
            date: '2026-06-20',
            startTime: '17:00',
            endTime: '19:00',
            courtId: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
            courtName: 'San 1',
            status: 'CONFIRMED',
            assignedMatch: {
              id: 12,
              round: 'Semifinal',
              eventId: 3,
              eventName: "Men's Singles",
              status: 'scheduled',
              team1Name: 'Đội 1',
              team2Name: 'Đội 2',
            },
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Center not selected, or missing date.' })
  @ApiResponse({ status: 404, description: 'Tournament not found.' })
  bookedSlots(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Query('centerId', new ParseUUIDPipe()) centerId: string,
    @Query('date') date: string,
  ) {
    return this.courtsService.getBookedSlots(tournamentId, centerId, date);
  }
}
