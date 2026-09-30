import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SportCenterClient } from '../clients/sport-center.client';
import { MatchLike, MatchView, toMatchView } from './match-view';

/**
 * Turns local `Match` rows into the enriched FE `Match` shape: looks up each event's
 * seed numbers and resolves each scheduled fixture's live sport-center court (name +
 * status) in one batch, so callers return enriched teams/court instead of bare ids.
 */
@Injectable()
export class MatchViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sportCenter: SportCenterClient,
  ) {}

  async enrich(tournamentId: number, matches: MatchLike[]): Promise<MatchView[]> {
    if (matches.length === 0) return [];

    const seeds = await this.prisma.seed.findMany({ where: { tournamentId }, select: { teamId: true, seed: true } });
    const seedByTeam = new Map(seeds.map((s) => [s.teamId, s.seed]));
    const courtInfoByFixture = await this.resolveCourts(matches);

    return matches.map((m) => {
      const info = courtInfoByFixture.get(m.id) ?? null;
      return toMatchView(m, {
        seedByTeam,
        court: info?.court ?? null,
        date: info?.date ?? null,
        startTime: info?.startTime ?? null,
        endTime: info?.endTime ?? null,
      });
    });
  }

  /**
   * Resolve each scheduled fixture's booked slot to its live sport-center court.
   * Walks fixture → booking mirror → booking item → court id, then fetches the courts
   * in a single batch. Returns a `Map<fixtureId, court>`.
   */
  async resolveCourts(matches: MatchLike[]): Promise<Map<number, any>> {
    const bookingIds = [...new Set(matches.map((m) => m.bookingId).filter((id): id is number => id != null))];
    if (bookingIds.length === 0) return new Map();

    const mirrors = await this.prisma.tournamentBooking.findMany({ where: { id: { in: bookingIds } } });
    const externalByLocal = new Map(mirrors.map((m) => [m.id, m.externalBookingId]));
    const localBookingMap = new Map(mirrors.map((m) => [m.id, m]));
    const live = await this.sportCenter.getBookingsByIds([...externalByLocal.values()]);

    const courtIdByItem = new Map<string, string>();
    const timesByItem = new Map<string, { startTime: string; endTime: string }>();

    for (const info of live.values()) {
      for (const item of info?.bookingItems ?? []) {
        if (item?.id) {
          if (item.courtId) courtIdByItem.set(item.id, item.courtId);
          timesByItem.set(item.id, { startTime: item.startTime, endTime: item.endTime });
        }
      }
    }

    const courtIds = [...new Set([...courtIdByItem.values()])];
    const courts = await this.sportCenter.getCourtsByIds(courtIds);

    const byFixture = new Map<number, any>();
    for (const m of matches) {
      if (!m.bookingItemId) continue;
      const courtId = courtIdByItem.get(m.bookingItemId);
      const times = timesByItem.get(m.bookingItemId);
      const mirror = m.bookingId ? localBookingMap.get(m.bookingId) : null;

      const courtObj = courtId && courts.has(courtId) ? courts.get(courtId) : null;

      const parseTimeToMinutes = (timeStr: string): number => {
        const parts = timeStr.split(':');
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        return hours * 60 + minutes;
      };
      const formatMinutesToTime = (mins: number): string => {
        const h = Math.floor(mins / 60).toString().padStart(2, '0');
        const m = (mins % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
      };

      let startTime = times?.startTime ? times.startTime.slice(0, 5) : null;
      let endTime = times?.endTime ? times.endTime.slice(0, 5) : null;

      if (m.time) {
        startTime = new Date(m.time).toISOString().slice(11, 16);
        const duration = m.duration ?? 45;
        const startMins = parseTimeToMinutes(startTime);
        endTime = formatMinutesToTime(startMins + duration);
      }

      byFixture.set(m.id, {
        court: courtObj,
        date: mirror?.date ? new Date(mirror.date).toISOString().slice(0, 10) : null,
        startTime,
        endTime,
      });
    }
    return byFixture;
  }
}
