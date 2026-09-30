import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SportCenterClient } from '../clients/sport-center.client';
import { CenterListResponseDto, TournamentCenterDto } from './dto/center-response.dto';

@Injectable()
export class CourtsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sportCenter: SportCenterClient,
  ) {}

  private async getTournament(tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      throw new NotFoundException(`Tournament ${tournamentId} not found`);
    }
    return tournament;
  }

  /** List the tournament's selected centers, enriched with name/address and courts. */
  async listCenters(tournamentId: number, authHeader?: string): Promise<CenterListResponseDto> {
    const tournament = await this.getTournament(tournamentId);

    const data: TournamentCenterDto[] = await Promise.all(
      tournament.centerIds.map(async (centerId) => {
        const [center, courts] = await Promise.all([
          this.sportCenter.getCenter(centerId, authHeader),
          this.sportCenter.getCenterCourts(centerId, authHeader),
        ]);
        return {
          centerId,
          name: center?.name ?? null,
          address: center?.address ?? null,
          status: center?.status ?? null,
          exists: !!center,
          courts: courts.map((c) => ({
            courtId: c.id,
            name: c.name,
            type: c.type ?? null,
            status: c.status ?? null,
          })),
        };
      }),
    );

    return { data, meta: { total: data.length } };
  }

  /** Add center(s) to the selection after validating each exists in sport-center. */
  async addCenters(tournamentId: number, centerIds: string[], authHeader?: string): Promise<CenterListResponseDto> {
    const tournament = await this.getTournament(tournamentId);

    const toAdd = Array.from(new Set(centerIds));
    for (const centerId of toAdd) {
      const center = await this.sportCenter.getCenter(centerId, authHeader);
      if (!center) {
        throw new BadRequestException(`Center ${centerId} does not exist in sport-center.`);
      }
    }

    const merged = Array.from(new Set([...tournament.centerIds, ...toAdd]));
    await this.prisma.tournament.update({ where: { id: tournamentId }, data: { centerIds: merged } });

    return this.listCenters(tournamentId, authHeader);
  }

  /** Remove a center from the selection. Guarded against in-use centers (Commit 5). */
  async removeCenter(tournamentId: number, centerId: string, authHeader?: string): Promise<CenterListResponseDto> {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament.centerIds.includes(centerId)) {
      throw new NotFoundException(`Center ${centerId} is not selected for this tournament.`);
    }

    await this.assertCenterRemovable(tournamentId, centerId);

    const remaining = tournament.centerIds.filter((c) => c !== centerId);
    await this.prisma.tournament.update({ where: { id: tournamentId }, data: { centerIds: remaining } });

    return this.listCenters(tournamentId, authHeader);
  }

  /**
   * Block removing a center while it still has an active (non-cancelled) booking.
   * Cancelling a booking unlinks its fixtures and frees the center, so this single
   * check covers both "has bookings" and "has linked fixtures".
   */
  private async assertCenterRemovable(tournamentId: number, centerId: string): Promise<void> {
    const active = await this.prisma.tournamentBooking.count({
      where: { tournamentId, centerId, statusMirror: { not: 'CANCELLED' } },
    });
    if (active > 0) {
      throw new BadRequestException(
        `Center ${centerId} still has ${active} active booking(s); cancel them before removing the center.`,
      );
    }
  }

  /** Proxy a center's bulk court availability for a date (organizer JWT forwarded). */
  async getAvailability(tournamentId: number, centerId: string, date: string, authHeader?: string) {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament.centerIds.includes(centerId)) {
      throw new BadRequestException(`Center ${centerId} is not selected for this tournament.`);
    }
    if (!date) {
      throw new BadRequestException('A `date` query parameter is required.');
    }

    const availability = await this.sportCenter.getCourtAvailability(centerId, date, authHeader);
    if (!availability) {
      throw new NotFoundException(`Availability unavailable for center ${centerId} (not found or inactive).`);
    }
    return availability;
  }

  /** Get all booked slots (booking items) of a tournament filtered by centerId and date. */
  async getBookedSlots(tournamentId: number, centerId: string, date: string) {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament.centerIds.includes(centerId)) {
      throw new BadRequestException(`Center ${centerId} is not selected for this tournament.`);
    }
    if (!date) {
      throw new BadRequestException('A `date` query parameter is required.');
    }

    const mirrors = await this.prisma.tournamentBooking.findMany({
      where: {
        tournamentId,
        centerId,
        date,
      },
    });

    if (mirrors.length === 0) {
      return [];
    }

    const live = await this.sportCenter.getBookingsByIds(mirrors.map((m) => m.externalBookingId));

    const matches = await this.prisma.match.findMany({
      where: { tournamentId },
      include: {
        event: { select: { name: true } },
        team1: true,
        team2: true,
      },
    });

    const matchMap = new Map<string, any>();
    for (const m of matches) {
      if (m.bookingItemId) {
        matchMap.set(m.bookingItemId, m);
      }
    }

    const items: any[] = [];
    for (const m of mirrors) {
      const info = live.get(m.externalBookingId);
      if (!info) continue;

      const dateYmd = m.date ? new Date(m.date).toISOString().slice(0, 10) : '';

      for (const slot of info.bookingItems ?? []) {
        const assignedMatch = matchMap.get(slot.id);

        items.push({
          bookingId: m.id,
          externalBookingId: m.externalBookingId,
          bookingItemId: slot.id,
          date: dateYmd,
          startTime: slot.startTime,
          endTime: slot.endTime,
          courtId: slot.courtId,
          courtName: slot.courtName || 'Sân đấu',
          status: info.status || 'PENDING',
          assignedMatch: assignedMatch
            ? {
                id: assignedMatch.id,
                round: assignedMatch.round,
                eventId: assignedMatch.eventId,
                eventName: assignedMatch.event?.name || 'Sự kiện',
                status: assignedMatch.status,
                team1Name: assignedMatch.team1?.name || 'Đội 1',
                team2Name: assignedMatch.team2?.name || 'Đội 2',
              }
            : null,
        });
      }
    }

    return items;
  }
}
