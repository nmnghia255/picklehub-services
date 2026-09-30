import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Thin client over match-service. match-service is the source of truth for match
 * execution (score/status); tournament-service only dispatches fixtures and mirrors
 * confirmed results. Internal calls (batch create, listing) carry match-service's own
 * token in the `x-internal-service-token` header; player/organizer-flow calls (confirm,
 * update) forward the caller's JWT in the `Authorization` header instead.
 */
@Injectable()
export class MatchClient {
  private readonly logger = new Logger(MatchClient.name);

  // #region Config

  private get baseUrl(): string {
    return process.env.MATCH_SERVICE_URL ?? 'http://localhost:8005';
  }

  private get internalToken(): string {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  private get internalHeaders() {
    return { 'x-internal-service-token': this.internalToken };
  }

  private authHeaders(authHeader?: string) {
    return authHeader ? { Authorization: authHeader } : {};
  }

  // #endregion

  /**
   * Create a batch of TOURNAMENT matches in match-service. Returns the created match
   * rows (each carrying its match-service UUID in `id`) or `[]` on failure. The batch
   * endpoint answers with `{ created, matches }`, in the same order as the input.
   */
  async createBatch(payload: unknown): Promise<any[]> {
    try {
      const res = await axios.post(
        `${this.baseUrl}/api/matches/internal/batch`,
        payload,
        { headers: this.internalHeaders, validateStatus: () => true },
      );
      if (res.status === 200 || res.status === 201) {
        if (Array.isArray(res.data?.matches)) return res.data.matches;
        return Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      }
      this.logger.error(`match-service batch create failed (${res.status}): ${JSON.stringify(res.data)}`);
    } catch (e) {
      this.logger.error(`Failed to create match batch: ${e}`);
    }
    return [];
  }

  /**
   * Confirm a match result in match-service (forwards the caller's JWT). The organizer
   * is the host of TOURNAMENT matches and so confirms in one shot. Returns the updated
   * match (`{ status, winner, scoreA, scoreB, … }`) or `null` on failure.
   */
  async confirmResult(externalMatchId: string, body: unknown, authHeader?: string): Promise<any | null> {
    try {
      const res = await axios.patch(
        `${this.baseUrl}/api/matches/${externalMatchId}/confirm`,
        body,
        { headers: this.authHeaders(authHeader), validateStatus: () => true },
      );
      if (res.status === 200 || res.status === 201) return res.data;
      this.logger.error(`match-service confirm failed for ${externalMatchId} (${res.status})`);
    } catch (e) {
      this.logger.error(`Failed to confirm match ${externalMatchId}: ${e}`);
    }
    return null;
  }

  /**
   * Patch a SCHEDULED match in match-service (forwards the caller's JWT). Used to push a
   * referee (re)assignment onto an already-dispatched fixture. Returns the updated match
   * or `null` on failure (e.g. the match has already started).
   */
  async updateMatch(externalMatchId: string, body: unknown, authHeader?: string): Promise<any | null> {
    try {
      const res = await axios.patch(
        `${this.baseUrl}/api/matches/${externalMatchId}`,
        body,
        { headers: this.authHeaders(authHeader), validateStatus: () => true },
      );
      if (res.status === 200 || res.status === 201) return res.data;
      this.logger.error(`match-service update failed for ${externalMatchId} (${res.status})`);
    } catch (e) {
      this.logger.error(`Failed to update match ${externalMatchId}: ${e}`);
    }
    return null;
  }

  /**
   * List a tournament's matches by its cross-service `uuid`, optionally filtered by
   * status (e.g. `CONFIRMED`). Returns the `items` array or `[]` on failure. Used by the
   * pull-based result sync.
   */
  async listByTournament(tournamentUuid: string, status?: string, limit = 200): Promise<any[]> {
    try {
      const res = await axios.get(`${this.baseUrl}/api/matches`, {
        params: { tournamentId: tournamentUuid, status, limit },
        headers: this.internalHeaders,
        validateStatus: () => true,
      });
      if (res.status === 200) return Array.isArray(res.data?.items) ? res.data.items : [];
      this.logger.error(`match-service list failed for tournament ${tournamentUuid} (${res.status})`);
    } catch (e) {
      this.logger.error(`Failed to list matches for tournament ${tournamentUuid}: ${e}`);
    }
    return [];
  }

  /**
   * Override a match result in match-service using internal token.
   * Allows tournament-service admin to manually overwrite a match score and status.
   */
  async overrideResult(externalMatchId: string, body: unknown): Promise<any | null> {
    try {
      const res = await axios.patch(
        `${this.baseUrl}/api/matches/internal/${externalMatchId}/override-result`,
        body,
        { headers: this.internalHeaders, validateStatus: () => true },
      );
      if (res.status === 200 || res.status === 201) return res.data;
      this.logger.error(`match-service override failed for ${externalMatchId} (${res.status})`);
    } catch (e) {
      this.logger.error(`Failed to override match ${externalMatchId}: ${e}`);
    }
    return null;
  }

  /**
   * Unsync a match schedule in match-service when it is unlinked/deleted from tournament-service.
   * Clears courtName and sets scheduled time to null.
   */
  async unsyncSchedule(externalMatchId: string): Promise<boolean> {
    try {
      const res = await axios.post(
        `${this.baseUrl}/api/matches/internal/fixtures/${externalMatchId}/schedule-unsync`,
        {},
        { headers: this.internalHeaders, validateStatus: () => true },
      );
      return res.status === 200 || res.status === 201;
    } catch (e) {
      this.logger.error(`Failed to unsync schedule for match ${externalMatchId}: ${e}`);
    }
    return false;
  }
}
