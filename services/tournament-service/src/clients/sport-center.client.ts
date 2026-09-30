import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Thin client over sport-center-service. sport-center owns courts, availability and
 * bookings; tournament-service delegates to it and keeps only a local booking mirror.
 * Internal calls carry sport-center's own token in the `x-internal-service-token`
 * header; player-flow booking calls (added in a later phase) forward the organizer's
 * JWT instead.
 */
@Injectable()
export class SportCenterClient {
  private readonly logger = new Logger(SportCenterClient.name);

  // #region Config

  private get baseUrl(): string {
    return process.env.SPORT_CENTER_SERVICE_URL ?? 'http://localhost:8007';
  }

  private get internalToken(): string {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  private get internalHeaders() {
    return { 'x-internal-service-token': this.internalToken };
  }

  // #endregion

  private authHeaders(authHeader?: string) {
    return authHeader ? { Authorization: authHeader } : {};
  }

  /**
   * Fetch a single center's detail (name/address/status). Returns `null` if it does
   * not exist (404) or on error — used to validate a center id and enrich the list.
   * Forwards the organizer's JWT.
   */
  async getCenter(centerId: string, authHeader?: string): Promise<any | null> {
    try {
      const res = await axios.get(`${this.baseUrl}/api/sport-centers/${centerId}`, {
        headers: this.authHeaders(authHeader),
        validateStatus: () => true,
      });
      if (res.status === 200) return res.data;
    } catch (e) {
      this.logger.error(`Failed to fetch center ${centerId}: ${e}`);
    }
    return null;
  }

  /** List a center's courts. Returns `[]` on failure. Forwards the organizer's JWT. */
  async getCenterCourts(centerId: string, authHeader?: string): Promise<any[]> {
    try {
      const res = await axios.get(`${this.baseUrl}/api/sport-centers/${centerId}/courts`, {
        headers: this.authHeaders(authHeader),
        validateStatus: () => true,
      });
      if (res.status === 200 && Array.isArray(res.data)) return res.data;
    } catch (e) {
      this.logger.error(`Failed to fetch courts for center ${centerId}: ${e}`);
    }
    return [];
  }

  /**
   * Bulk 30-minute court availability for a center on a date (all active courts).
   * Forwards the organizer's JWT (the sport-center endpoint requires it). Returns
   * `null` on failure.
   */
  async getCourtAvailability(centerId: string, date: string, authHeader?: string): Promise<any | null> {
    try {
      const res = await axios.get(`${this.baseUrl}/api/sport-centers/${centerId}/availability`, {
        params: { date },
        headers: this.authHeaders(authHeader),
        validateStatus: () => true,
      });
      if (res.status === 200) return res.data;
      this.logger.error(`Availability fetch failed for center ${centerId} (${res.status})`);
    } catch (e) {
      this.logger.error(`Failed to fetch availability for center ${centerId}: ${e}`);
    }
    return null;
  }

  /**
   * Resolve a set of court ids to their court objects (name, status, center, …) via
   * sport-center's internal batch endpoint. Returns a `Map<courtId, court>`; empty on
   * failure. Used to render court names on fixtures and validate court status.
   */
  async getCourtsByIds(courtIds: string[]): Promise<Map<string, any>> {
    const uniqueIds = Array.from(new Set(courtIds.filter(Boolean)));
    if (uniqueIds.length === 0) return new Map();
    try {
      const res = await axios.post(
        `${this.baseUrl}/api/sport-centers/internal/courts/batch`,
        { courtIds: uniqueIds },
        { headers: this.internalHeaders, validateStatus: () => true },
      );
      if ((res.status === 200 || res.status === 201) && Array.isArray(res.data)) {
        return new Map(res.data.map((c: any) => [c.id, c]));
      }
      this.logger.error(`sport-center courts batch failed (${res.status})`);
    } catch (e) {
      this.logger.error(`Failed to fetch courts: ${e}`);
    }
    return new Map();
  }

  // #region Bookings

  /**
   * Create court bookings via sport-center's unified bookings endpoint. Forwards
   * the organizer's JWT. Returns the list of created bookings (`[{ id, status, bookingItems, … }]`)
   * or `null` on failure.
   */
  async createBooking(centerId: string, body: unknown, authHeader?: string): Promise<any[] | null> {
    try {
      const res = await axios.post(
        `${this.baseUrl}/api/sport-centers/${centerId}/bookings`,
        body,
        { headers: this.authHeaders(authHeader), validateStatus: () => true },
      );
      if (res.status === 200 || res.status === 201) return res.data;
      this.logger.error(`Booking create failed for center ${centerId} (${res.status})`);
    } catch (e) {
      this.logger.error(`Failed to create booking: ${e}`);
    }
    return null;
  }

  /** Cancel a booking via the player-cancel flow. Forwards the organizer's JWT. */
  async cancelBooking(bookingId: string, authHeader?: string): Promise<any | null> {
    try {
      const res = await axios.patch(
        `${this.baseUrl}/api/bookings/${bookingId}/cancel`,
        {},
        { headers: this.authHeaders(authHeader), validateStatus: () => true },
      );
      if (res.status === 200) return res.data;
      this.logger.error(`Booking cancel failed for ${bookingId} (${res.status})`);
    } catch (e) {
      this.logger.error(`Failed to cancel booking ${bookingId}: ${e}`);
    }
    return null;
  }

  /**
   * Batch-fetch booking info (status + items) by ids via the internal endpoint.
   * Returns a `Map<bookingId, bookingInfo>`; empty on failure. Used to refresh the
   * local mirror's status and expose booking items.
   */
  async getBookingsByIds(bookingIds: string[]): Promise<Map<string, any>> {
    const uniqueIds = Array.from(new Set(bookingIds.filter(Boolean)));
    if (uniqueIds.length === 0) return new Map();
    try {
      const res = await axios.post(
        `${this.baseUrl}/api/bookings/batch`,
        { bookingIds: uniqueIds },
        { headers: this.internalHeaders, validateStatus: () => true },
      );
      if ((res.status === 200 || res.status === 201) && Array.isArray(res.data?.bookingInfos)) {
        return new Map(res.data.bookingInfos.map((b: any) => [b.id, b]));
      }
      this.logger.error(`Booking batch fetch failed (${res.status})`);
    } catch (e) {
      this.logger.error(`Failed to fetch bookings: ${e}`);
    }
    return new Map();
  }

  // #endregion
}
