import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CourtInfo {
  id: string;
  name: string;
  type: string;
  status: string;
  centerId: string;
  centerName: string;
  centerAddress: string;
}

export interface SportCenterBookingItem {
  courtId: string;
  startTime: string;
  endTime: string;
  court: { id: string; name: string };
}

export interface SportCenterBookingInfo {
  id: string;
  playerId: string;
  status: string;
  totalPrice: number;
  center: { id: string; name: string; address: string };
  bookingItems: SportCenterBookingItem[];
}

@Injectable()
export class SportCenterIntegrationService {
  private readonly logger = new Logger(SportCenterIntegrationService.name);

  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    return this.configService.get<string>('SPORT_CENTER_SERVICE_URL') ?? '';
  }

  private get token(): string {
    return this.configService.get<string>('SERVICE_INTERNAL_TOKEN') ?? '';
  }

  private async post<T>(path: string, body: object): Promise<T | null> {
    const url = `${this.baseUrl}${path}`;
    if (!this.baseUrl || !this.token) {
      this.logger.error('SPORT_CENTER_SERVICE_URL or SERVICE_INTERNAL_TOKEN is not configured');
      return null;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': this.token,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        this.logger.error(`sport-center internal call failed [${path}]: ${response.status} ${response.statusText}`);
        return null;
      }

      return response.json() as Promise<T>;
    } catch (error: any) {
      this.logger.error(`sport-center internal call error [${path}]: ${error.message}`);
      return null;
    }
  }

  /**
   * Batch-resolve courts by courtIds.
   * Returns a Map<courtId, CourtInfo> for address enrichment at read-time.
   * Reuses the existing POST /sport-centers/internal/courts/batch endpoint.
   */
  async getBatchCourts(courtIds: string[]): Promise<Map<string, CourtInfo>> {
    if (!courtIds || courtIds.length === 0) return new Map();

    const unique = Array.from(new Set(courtIds.filter(Boolean)));
    const result = await this.post<CourtInfo[]>('/sport-centers/internal/courts/batch', { courtIds: unique });

    if (!result) return new Map();
    return new Map(result.map((c) => [c.id, c]));
  }

  /**
   * Batch-fetch sport-center bookings by IDs.
   * Used at write-time to validate coach ownership and snapshot court cost.
   */
  async getBatchBookings(bookingIds: string[]): Promise<Map<string, SportCenterBookingInfo>> {
    if (!bookingIds || bookingIds.length === 0) return new Map();

    const unique = Array.from(new Set(bookingIds.filter(Boolean)));
    const result = await this.post<SportCenterBookingInfo[]>('/sport-centers/internal/bookings/batch', { bookingIds: unique });

    if (!result) return new Map();
    return new Map(result.map((b) => [b.id, b]));
  }

  /**
   * Validate that a sport-center booking:
   * 1. Exists and is CONFIRMED
   * 2. Belongs to the given coachUserId (playerId on the booking)
   * 3. Contains the given courtId (if provided)
   *
   * Returns the validated booking info (including totalPrice for cost snapshot).
   * Throws BadRequestException on any violation.
   */
  async validateAndGetCourtBooking(
    courtBookingId: string,
    coachUserId: string,
    courtId?: string,
  ): Promise<SportCenterBookingInfo> {
    const bookings = await this.getBatchBookings([courtBookingId]);
    const booking = bookings.get(courtBookingId);

    if (!booking) {
      throw new BadRequestException(`Sport-center booking ${courtBookingId} not found.`);
    }
    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        `Sport-center booking ${courtBookingId} must be CONFIRMED (current: ${booking.status}).`,
      );
    }
    if (booking.playerId !== coachUserId) {
      throw new BadRequestException('You can only link a court booking that belongs to your own account.');
    }
    if (courtId) {
      const hasCourtId = booking.bookingItems.some((item) => item.courtId === courtId);
      if (!hasCourtId) {
        throw new BadRequestException(`Court ${courtId} is not part of booking ${courtBookingId}.`);
      }
    }

    return booking;
  }
}
