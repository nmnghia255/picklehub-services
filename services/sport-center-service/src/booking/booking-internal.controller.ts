import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { BookingService } from './booking.service';

@ApiTags('internal')
@Controller('sport-centers/internal')
@UseGuards(InternalServiceGuard)
@ApiSecurity('internal-service-token')
export class BookingInternalController {
  constructor(private readonly bookingService: BookingService) {}

  /**
   * Batch-fetch sport-center bookings by IDs.
   * Called by coach-service to:
   *   1. Validate coach ownership (playerId === coach userId) at write-time
   *   2. Snapshot court cost (totalPrice) at write-time
   * Returns: { id, playerId, status, totalPrice, center, bookingItems }
   */
  @Post('bookings/batch')
  async getBatchBookings(@Body() body: { bookingIds: string[] }) {
    if (!body.bookingIds || !Array.isArray(body.bookingIds)) return [];

    const unique = Array.from(new Set(body.bookingIds.filter(Boolean)));
    if (unique.length === 0) return [];

    const { bookingInfos } = await this.bookingService.getBookingsByIds(unique);
    return bookingInfos;
  }
}
