import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SportCenterClient } from '../clients/sport-center.client';
import { MatchViewService } from '../common/match-view.service';
import { MatchClient } from '../clients/match.client';
import { CreateBookingDto } from './dto/create-booking.dto';
import { ScheduleFixtureDto } from './dto/schedule-fixture.dto';
import { NotificationClient } from '../clients/notification.client';
import { AutoScheduleConfigDto, OptimizationCriteria } from './dto/auto-schedule-config.dto';
import { ConfirmScheduleDto } from './dto/confirm-schedule.dto';
import { MatchStatus } from '@prisma/client';

const NON_BLOCKING_STATUSES = ['walkover', 'completed'];

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sportCenter: SportCenterClient,
    private readonly matchView: MatchViewService,
    private readonly notificationClient: NotificationClient,
    private readonly match: MatchClient,
  ) { }

  // #region Helpers

  private getMatchPlayerIds(m: any): string[] {
    const ids: string[] = [];
    if (m.team1) {
      if (m.team1.player1Id) ids.push(m.team1.player1Id);
      if (m.team1.player2Id) ids.push(m.team1.player2Id);
    }
    if (m.team2) {
      if (m.team2.player1Id) ids.push(m.team2.player1Id);
      if (m.team2.player2Id) ids.push(m.team2.player2Id);
    }
    return ids;
  }

  private getPlayerNameById(m: any, id: string): string {
    if (m.team1) {
      if (m.team1.player1Id === id && m.team1.player1Name) return m.team1.player1Name;
      if (m.team1.player2Id === id && m.team1.player2Name) return m.team1.player2Name;
    }
    if (m.team2) {
      if (m.team2.player1Id === id && m.team2.player1Name) return m.team2.player1Name;
      if (m.team2.player2Id === id && m.team2.player2Name) return m.team2.player2Name;
    }
    return '';
  }

  private parseTimeToMinutes(timeStr: string): number {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    return hours * 60 + minutes;
  }

  private formatMinutesToTime(mins: number): string {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private getRoundPrecedence(round: string | null | undefined): number {
    if (!round) return 999;
    const clean = round.trim().toLowerCase();

    // Group stage: "round 1", "round 2", etc.
    const groupMatch = clean.match(/^round\s+(\d+)$/);
    if (groupMatch) {
      return parseInt(groupMatch[1], 10);
    }

    // Knockout/bracket rounds
    if (clean.includes('final') && !clean.includes('semi') && !clean.includes('quarter')) {
      return 100; // Finals at the very end
    }
    if (clean.includes('semifinal') || clean.includes('semi-final')) {
      return 80;
    }
    if (clean.includes('quarterfinal') || clean.includes('quarter-final')) {
      return 60;
    }

    // "round of 16", "round of 32", etc.
    const roundOfMatch = clean.match(/^round\s+of\s+(\d+)$/);
    if (roundOfMatch) {
      const size = parseInt(roundOfMatch[1], 10);
      return 60 - Math.log2(size); // larger size comes first, e.g. size 64 -> 54, size 32 -> 55, size 16 -> 56
    }

    return 50; // default fallback
  }

  private async getTournament(tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException(`Tournament ${tournamentId} not found`);
    return tournament;
  }

  private async getBookingMirror(tournamentId: number, bookingId: number) {
    const booking = await this.prisma.tournamentBooking.findFirst({ where: { id: bookingId, tournamentId } });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found in tournament ${tournamentId}`);
    return booking;
  }

  private async getFixture(tournamentId: number, fixtureId: number) {
    const fixture = await this.prisma.match.findFirst({ where: { id: fixtureId, tournamentId } });
    if (!fixture) throw new NotFoundException(`Fixture ${fixtureId} not found in tournament ${tournamentId}`);
    return fixture;
  }

  // #endregion

  /** Create court bookings (single or multi-day) and persist their local mirrors. */
  async createBooking(tournamentId: number, dto: CreateBookingDto, authHeader?: string) {
    const tournament = await this.getTournament(tournamentId);
    if (!tournament.centerIds.includes(dto.centerId)) {
      throw new BadRequestException(`Center ${dto.centerId} is not selected for this tournament.`);
    }

    const createdList = await this.sportCenter.createBooking(
      dto.centerId,
      {
        bookings: dto.bookings,
        playerName: dto.playerName ?? 'Tournament Organizer',
        phoneNumber: dto.phoneNumber,
        useCredit: false,
      },
      authHeader,
    );

    if (!createdList || createdList.length === 0) {
      throw new BadRequestException('Bookings could not be created in sport-center (slot unavailable or invalid).');
    }

    const mirrors = await this.prisma.$transaction(async (tx) => {
      const list = [];
      for (const item of createdList) {
        const mirror = await tx.tournamentBooking.create({
          data: {
            tournamentId,
            externalBookingId: item.id,
            centerId: dto.centerId,
            date: item.date ? new Date(item.date).toISOString().slice(0, 10) : null,
            statusMirror: item.status ?? 'PENDING',
            totalPrice: item.totalPrice ?? null,
          },
        });
        list.push({ booking: mirror, sportCenter: item });
      }
      return list;
    });

    return mirrors;
  }

  /** List the tournament's bookings, enriched with live status/items + linked fixtures. */
  async listBookings(tournamentId: number) {
    await this.getTournament(tournamentId);

    const [mirrors, fixtures] = await Promise.all([
      this.prisma.tournamentBooking.findMany({ where: { tournamentId }, orderBy: { id: 'asc' } }),
      this.prisma.match.findMany({
        where: { tournamentId, bookingId: { not: null } },
        select: { id: true, bookingId: true, bookingItemId: true, round: true },
      }),
    ]);

    const live = await this.sportCenter.getBookingsByIds(mirrors.map((m) => m.externalBookingId));

    const data = mirrors.map((m) => {
      const info = live.get(m.externalBookingId);
      return {
        id: m.id,
        externalBookingId: m.externalBookingId,
        centerId: m.centerId,
        date: m.date,
        statusMirror: m.statusMirror,
        liveStatus: info?.status ?? null,
        totalPrice: m.totalPrice,
        items: info?.bookingItems ?? [],
        fixtures: fixtures.filter((f) => f.bookingId === m.id),
      };
    });

    return { data, meta: { total: data.length } };
  }

  /** Cancel a booking (sport-center + mirror), and unlink any fixtures using it. */
  async cancelBooking(tournamentId: number, bookingId: number, authHeader?: string) {
    const mirror = await this.getBookingMirror(tournamentId, bookingId);

    const affectedFixtures = await this.prisma.match.findMany({
      where: { tournamentId, bookingId },
    });

    for (const f of affectedFixtures) {
      if (f.status === MatchStatus.completed) {
        throw new BadRequestException(`Cannot cancel booking because match #${f.id} is already completed.`);
      }
      if (f.status === MatchStatus.in_progress) {
        throw new BadRequestException(`Cannot cancel booking because match #${f.id} is currently in progress.`);
      }
    }

    const cancelled = await this.sportCenter.cancelBooking(mirror.externalBookingId, authHeader);
    if (!cancelled) {
      // The cancel may have failed because the booking already expired/cancelled.
      // Reconcile from live state: if it is already CANCELLED, treat this as success
      // (idempotent); otherwise (e.g. COMPLETED) surface the failure.
      const live = await this.sportCenter.getBookingsByIds([mirror.externalBookingId]);
      const liveStatus = live.get(mirror.externalBookingId)?.status;
      if (liveStatus !== 'CANCELLED') {
        throw new BadRequestException('Booking could not be cancelled in sport-center (already completed, or not allowed).');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.match.updateMany({ where: { tournamentId, bookingId }, data: { bookingId: null, bookingItemId: null } });
      await tx.tournamentBooking.update({ where: { id: bookingId }, data: { statusMirror: 'CANCELLED' } });
      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'BOOKING_CANCEL',
          oldValue: mirror as any,
        },
      });
    });

    for (const f of affectedFixtures) {
      if (f.externalMatchId) {
        void this.match.unsyncSchedule(f.externalMatchId);
      }
    }

    return this.getBookingMirror(tournamentId, bookingId);
  }

  /** Refresh every mirror's status from sport-center. */
  async syncBookings(tournamentId: number) {
    await this.getTournament(tournamentId);
    const mirrors = await this.prisma.tournamentBooking.findMany({ where: { tournamentId } });
    const live = await this.sportCenter.getBookingsByIds(mirrors.map((m) => m.externalBookingId));

    await this.prisma.$transaction(async (tx) => {
      for (const m of mirrors) {
        const info = live.get(m.externalBookingId);
        if (!info || info.status === m.statusMirror) continue;

        await tx.tournamentBooking.update({
          where: { id: m.id },
          data: { statusMirror: info.status },
        });

        if (info.status === 'CANCELLED') {
          await tx.match.updateMany({
            where: { tournamentId, bookingId: m.id },
            data: { bookingId: null, bookingItemId: null },
          });
        }
      }
    });

    return this.listBookings(tournamentId);
  }

  /** Link a fixture to a specific court+time slot of a booking. */
  async scheduleFixture(tournamentId: number, fixtureId: number, dto: ScheduleFixtureDto) {
    const fixture = await this.getFixture(tournamentId, fixtureId);

    const event = await this.prisma.tournamentEvent.findFirst({
      where: { id: fixture.eventId, tournamentId },
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${fixture.eventId} not found`);
    }
    if (!fixture.groupStage && event.bracketStatus !== 'locked') {
      throw new BadRequestException('Nhánh đấu (Bracket) phải được khóa trước khi xếp lịch thi đấu.');
    }

    // Fetch old fixture view before update
    const oldFixture = await this.enrichFixture(tournamentId, fixtureId).catch(() => null);

    const mirror = await this.getBookingMirror(tournamentId, dto.bookingId);

    const live = await this.sportCenter.getBookingsByIds([mirror.externalBookingId]);
    const info = live.get(mirror.externalBookingId);

    if (info && info.status !== mirror.statusMirror) {
      await this.prisma.$transaction(async (tx) => {
        await tx.tournamentBooking.update({
          where: { id: mirror.id },
          data: { statusMirror: info.status },
        });
        if (info.status === 'CANCELLED') {
          await tx.match.updateMany({
            where: { tournamentId, bookingId: mirror.id },
            data: { bookingId: null, bookingItemId: null },
          });
        }
      });
      mirror.statusMirror = info.status;
    }

    if (mirror.statusMirror !== 'CONFIRMED') {
      throw new BadRequestException('Trận đấu chỉ có thể được xếp lịch vào lượt đặt sân đã được xác nhận (CONFIRMED).');
    }

    const item = (info?.bookingItems ?? []).find((i: any) => i.id === dto.bookingItemId);
    if (!item) {
      throw new BadRequestException(`Booking item ${dto.bookingItemId} does not belong to booking ${dto.bookingId}.`);
    }

    const parseTimeToMinutes = (timeStr: string): number => {
      const parts = timeStr.split(':');
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      return hours * 60 + minutes;
    };

    const matchDuration = dto.matchDurationMinutes ?? (fixture as any).duration ?? 45;
    const dateYmd = mirror.date ? new Date(mirror.date).toISOString().slice(0, 10) : '';
    const matchStartTimeStr = item.startTime.slice(0, 5);
    const matchStartMins = this.parseTimeToMinutes(matchStartTimeStr);

    const allMirrors = await this.prisma.tournamentBooking.findMany({
      where: { tournamentId },
    });
    const allLive = await this.sportCenter.getBookingsByIds(allMirrors.map((m) => m.externalBookingId));

    const itemMap = new Map<string, { startTime: string; endTime: string; dateYmd: string; courtId: string }>();
    for (const m of allMirrors) {
      const bInfo = allLive.get(m.externalBookingId);
      if (!bInfo || bInfo.status === 'CANCELLED') continue;
      const dYmd = m.date ? new Date(m.date).toISOString().slice(0, 10) : '';
      for (const s of bInfo.bookingItems ?? []) {
        itemMap.set(s.id, {
          startTime: s.startTime,
          endTime: s.endTime,
          dateYmd: dYmd,
          courtId: s.courtId || '',
        });
      }
    }

    const allDbMatches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        bookingItemId: { not: null },
        id: { not: fixtureId },
      },
    });

    const clashingMatch = allDbMatches.find((dbm) => {
      const dbmItem = itemMap.get(dbm.bookingItemId!);
      if (dbmItem && dbmItem.courtId === item.courtId && dbmItem.dateYmd === dateYmd) {
        const dbmStart = dbm.time
          ? this.parseTimeToMinutes(new Date(dbm.time).toISOString().slice(11, 16))
          : this.parseTimeToMinutes(dbmItem.startTime);
        const dbmDuration = dbm.duration ?? 45;
        const dbmEnd = dbmStart + dbmDuration;
        return !(matchStartMins >= dbmEnd || dbmEnd <= matchStartMins);
      }
      return false;
    });

    if (clashingMatch) {
      throw new BadRequestException(`Sân đấu/khung giờ đã được gán cho trận đấu khác có ID ${clashingMatch.id}.`);
    }

    const updated = await this.prisma.match.update({
      where: { id: fixtureId },
      data: {
        bookingId: dto.bookingId,
        bookingItemId: dto.bookingItemId,
        duration: dto.matchDurationMinutes,
        time: new Date(`${dateYmd}T${matchStartTimeStr}:00.000Z`),
      },
    });

    const newFixture = await this.enrichFixture(tournamentId, fixtureId);

    await this.prisma.auditLog.create({
      data: {
        tournamentId,
        action: 'FIXTURE_SCHEDULE',
        oldValue: oldFixture as any,
        newValue: newFixture as any,
      },
    }).catch(err => this.logger.error(`Failed to write schedule audit log: ${err}`));

    // Fire-and-forget notification
    void this.handleCourtChangeNotification(oldFixture, newFixture, tournamentId);

    const rest = 15;
    const finalWarnings = this.detectPlayerWarnings(
      [{
        match: updated,
        slot: {
          date: dateYmd,
          startTime: matchStartTimeStr,
          endTime: this.formatMinutesToTime(matchStartMins + matchDuration),
        }
      }],
      await this.prisma.match.findMany({
        where: { tournamentId, id: { not: fixtureId }, bookingItemId: { not: null } },
        include: { team1: true, team2: true }
      }),
      allMirrors,
      allLive,
      rest
    );

    return {
      ...newFixture,
      warnings: finalWarnings,
    };
  }

  private async handleCourtChangeNotification(oldFixture: any, newFixture: any, tournamentId: number) {
    try {
      if (!newFixture?.court) return;
      if (oldFixture && oldFixture.court === newFixture.court && oldFixture.bookingItemId === newFixture.bookingItemId) return;

      const tournament = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { name: true }
      });
      if (!tournament) return;

      const teamIds = [newFixture.team1?.teamId, newFixture.team2?.teamId].filter((id): id is number => id != null);
      if (teamIds.length === 0) return;

      const teams = await this.prisma.team.findMany({
        where: { id: { in: teamIds } }
      });

      const playerIds = new Set<string>();
      for (const team of teams) {
        if (team.player1Id) playerIds.add(team.player1Id);
        if (team.player2Id) playerIds.add(team.player2Id);
      }

      const oldCourtName = oldFixture?.court ?? 'Chưa xếp sân';
      const newCourtName = newFixture.court;

      let timeStr = 'Chưa xác định';
      if (newFixture.bookingId && newFixture.bookingItemId) {
        const mirror = await this.prisma.tournamentBooking.findFirst({
          where: { id: newFixture.bookingId }
        });
        if (mirror) {
          const live = await this.sportCenter.getBookingsByIds([mirror.externalBookingId]);
          const info = live.get(mirror.externalBookingId);
          const item = info?.bookingItems?.find((i: any) => i.id === newFixture.bookingItemId);
          if (info?.date) {
            const ymd = new Date(info.date).toISOString().slice(0, 10);
            const hhmm = item?.startTime ? item.startTime.slice(0, 5) : '';
            timeStr = hhmm ? `${ymd} ${hhmm}` : ymd;
          }
        }
      }

      const actionUrl = `${this.notificationClient.frontendUrl}/tournaments/${tournamentId}/schedule`;

      for (const playerId of playerIds) {
        const email = await this.notificationClient.getUserEmail(playerId);
        if (!email) continue;

        let name = 'Vận động viên';
        for (const team of teams) {
          if (team.player1Id === playerId) {
            name = team.player1Name;
            break;
          }
          if (team.player2Id === playerId && team.player2Name) {
            name = team.player2Name;
            break;
          }
        }

        void this.notificationClient.sendEmail(
          email,
          'tournament_court_change',
          {
            playerName: name,
            tournamentName: tournament.name,
            actionUrl,
          }
        );
      }

      if (playerIds.size > 0) {
        await this.notificationClient.sendInAppNotification(
          Array.from(playerIds),
          'Thay đổi lịch/sân đấu',
          `Trận đấu vòng ${newFixture.round ?? 'thi đấu'} của bạn tại giải đấu ${tournament.name} có sự thay đổi về lịch hoặc sân đấu.`
        );
      }
    } catch (err) {
      this.logger.error(`Failed to handle court change notification: ${err}`);
    }
  }

  async unlinkFixture(tournamentId: number, fixtureId: number) {
    const oldFixture = await this.getFixture(tournamentId, fixtureId);

    if (oldFixture.status === MatchStatus.completed) {
      throw new BadRequestException('Cannot unlink booking for a completed match.');
    }
    if (oldFixture.status === MatchStatus.in_progress) {
      throw new BadRequestException('Cannot unlink booking for an in-progress match.');
    }

    const oldEnriched = await this.enrichFixture(tournamentId, fixtureId).catch(() => null);

    await this.prisma.match.update({
      where: { id: fixtureId },
      data: { bookingId: null, bookingItemId: null },
    });

    const newFixture = await this.enrichFixture(tournamentId, fixtureId);

    await this.prisma.auditLog.create({
      data: {
        tournamentId,
        action: 'FIXTURE_UNLINK',
        oldValue: oldEnriched as any,
        newValue: newFixture as any,
      },
    }).catch(err => this.logger.error(`Failed to write unlink audit log: ${err}`));

    if (oldFixture.externalMatchId) {
      void this.match.unsyncSchedule(oldFixture.externalMatchId);
    }

    return newFixture;
  }

  /** Reload one fixture with its relations and enrich it to the FE Match shape. */
  private async enrichFixture(tournamentId: number, fixtureId: number) {
    const rows = await this.prisma.match.findMany({
      where: { id: fixtureId, tournamentId },
      include: { team1: true, team2: true, event: { select: { name: true } } },
    });
    const [view] = await this.matchView.enrich(tournamentId, rows);
    return view;
  }

  /** Fixture timeline + how many real fixtures still need a booking, enriched to the FE Match shape. */
  async getSchedule(
    tournamentId: number,
    eventId?: number,
    courtId?: number,
    date?: string,
    status?: any,
    scheduled?: boolean,
  ) {
    await this.getTournament(tournamentId);

    const whereClause: any = { tournamentId };
    if (eventId !== undefined) {
      whereClause.eventId = eventId;
    }
    if (courtId !== undefined) {
      whereClause.courtId = courtId;
    }
    if (status !== undefined) {
      whereClause.status = status;
    }
    if (scheduled !== undefined) {
      if (scheduled) {
        whereClause.bookingItemId = { not: null };
      } else {
        whereClause.bookingItemId = null;
      }
    }
    if (date) {
      const start = new Date(date);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setUTCHours(23, 59, 59, 999);
      whereClause.time = {
        gte: start,
        lte: end,
      };
    }

    const matches = await this.prisma.match.findMany({
      where: whereClause,
      orderBy: { id: 'asc' },
      include: { team1: true, team2: true, event: { select: { name: true } } },
    });

    const needsCourt = (m: (typeof matches)[number]) =>
      m.team1Id != null && m.team2Id != null && !NON_BLOCKING_STATUSES.includes(m.status);

    const bookingsRemaining = matches.filter((m) => needsCourt(m) && m.bookingId == null).length;

    return {
      data: await this.matchView.enrich(tournamentId, matches),
      meta: { total: matches.length, bookingsRemaining },
    };
  }

  private async runAutoScheduleEngine(
    tournamentId: number,
    eventId: number,
    dto: AutoScheduleConfigDto,
  ) {
    const event = await this.prisma.tournamentEvent.findFirst({
      where: { id: eventId, tournamentId },
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found in tournament ${tournamentId}`);
    }

    // 1. Fetch playable matches (all unassigned matches in the event)
    // Sort by round first so Round 1 slots are filled before Round 2/3,
    // preventing same-player conflicts across rounds scheduled on different courts.
    const playableMatches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        eventId,
        bookingItemId: null,
        status: { notIn: ['completed', 'walkover'] },
      },
      include: {
        team1: true,
        team2: true,
      },
      orderBy: { id: 'asc' },
    });

    // In-memory sort by round precedence and then by match ID to guarantee correct ordering
    // for both Group Stage (Round 1 -> 2 -> 3) and Knockout Stage (Round of 32 -> 16 -> Quarter -> Semi -> Final)
    playableMatches.sort((a, b) => {
      const pA = this.getRoundPrecedence(a.round);
      const pB = this.getRoundPrecedence(b.round);
      if (pA !== pB) return pA - pB;
      return a.id - b.id;
    });

    if (playableMatches.length === 0) {
      const totalMatches = await this.prisma.match.count({ where: { tournamentId, eventId } });
      if (totalMatches === 0) {
        throw new BadRequestException('Chưa tạo trận đấu vòng bảng cho sự kiện này. Vui lòng tạo vòng bảng trước.');
      }
      throw new BadRequestException('Tất cả các trận đấu trong sự kiện này đã được xếp lịch.');
    }

    const hasKnockoutMatches = playableMatches.some((m) => !m.groupStage);
    if (hasKnockoutMatches && event.bracketStatus !== 'locked') {
      throw new BadRequestException('Nhánh đấu (Bracket) phải được khóa trước khi xếp lịch thi đấu.');
    }

    const windowStart = this.parseTimeToMinutes(dto.startTime);
    const windowEnd = this.parseTimeToMinutes(dto.endTime);

    // 2. Fetch bookings and sync their latest status before selecting CONFIRMED slots
    const synced = await this.syncBookings(tournamentId);

    if (synced.data.length === 0) {
      throw new BadRequestException('Giải đấu chưa có bất kỳ lượt đặt sân (Booking) nào. Vui lòng đặt sân trước.');
    }

    const mirrors = synced.data.filter((b) => b.statusMirror === 'CONFIRMED');

    if (mirrors.length === 0) {
      throw new BadRequestException('Không tìm thấy lượt đặt sân nào ở trạng thái CONFIRMED. Vui lòng xác nhận thanh toán trước.');
    }

    const live = new Map<string, any>(synced.data.map((b) => [b.externalBookingId, b]));

    // Group confirmed booking items by court and date to merge contiguous blocks
    type TempItem = {
      bookingId: number;
      bookingItemId: string;
      courtId: string;
      courtName: string;
      date: string;
      start: number;
      end: number;
    };
    const itemsByCourtAndDate = new Map<string, TempItem[]>();

    for (const m of mirrors) {
      if (!m.date) continue;
      const info = live.get(m.externalBookingId);
      if (!info || info.liveStatus === 'CANCELLED') continue;
      const dateYmd = new Date(m.date).toISOString().slice(0, 10);

      for (const item of info.items ?? []) {
        if (dto.courtIds && dto.courtIds.length && item.courtId && !dto.courtIds.includes(item.courtId)) {
          continue;
        }

        const start = this.parseTimeToMinutes(item.startTime);
        const end = this.parseTimeToMinutes(item.endTime);
        const effectiveStart = Math.max(start, windowStart);
        const effectiveEnd = Math.min(end, windowEnd);
        if (effectiveStart >= effectiveEnd) continue;

        const courtKey = `${item.courtId || 'default'}_${dateYmd}`;
        if (!itemsByCourtAndDate.has(courtKey)) {
          itemsByCourtAndDate.set(courtKey, []);
        }
        itemsByCourtAndDate.get(courtKey)!.push({
          bookingId: m.id,
          bookingItemId: item.id,
          courtId: item.courtId || '',
          courtName: item.courtName || item.courtId || 'Sân đấu',
          date: dateYmd,
          start: effectiveStart,
          end: effectiveEnd,
        });
      }
    }

    const mergedBlocksByCourt: {
      bookingId: number;
      bookingItemId: string;
      courtId: string;
      courtName: string;
      date: string;
      start: number;
      end: number;
      originalItems: { start: number; end: number; id: string; bookingId: number }[];
    }[] = [];

    for (const list of itemsByCourtAndDate.values()) {
      list.sort((a, b) => a.start - b.start);

      const merged: typeof mergedBlocksByCourt = [];
      for (const item of list) {
        if (merged.length === 0) {
          merged.push({
            bookingId: item.bookingId,
            bookingItemId: item.bookingItemId,
            courtId: item.courtId,
            courtName: item.courtName,
            date: item.date,
            start: item.start,
            end: item.end,
            originalItems: [{ start: item.start, end: item.end, id: item.bookingItemId, bookingId: item.bookingId }],
          });
        } else {
          const last = merged[merged.length - 1];
          if (item.start <= last.end) {
            last.end = Math.max(last.end, item.end);
            last.originalItems.push({ start: item.start, end: item.end, id: item.bookingItemId, bookingId: item.bookingId });
          } else {
            merged.push({
              bookingId: item.bookingId,
              bookingItemId: item.bookingItemId,
              courtId: item.courtId,
              courtName: item.courtName,
              date: item.date,
              start: item.start,
              end: item.end,
              originalItems: [{ start: item.start, end: item.end, id: item.bookingItemId, bookingId: item.bookingId }],
            });
          }
        }
      }
      mergedBlocksByCourt.push(...merged);
    }

    // Subdivide merged blocks into consecutive match slots of (duration + rest)
    const allSlots: any[] = [];
    const rest = dto.restDurationMinutes ?? 15;
    const slotDuration = dto.matchDurationMinutes! + rest;

    for (const block of mergedBlocksByCourt) {
      let currentStart = block.start;
      while (currentStart + dto.matchDurationMinutes! <= block.end) {
        const playEnd = currentStart + dto.matchDurationMinutes!;
        const totalEnd = Math.min(currentStart + slotDuration, block.end);

        const original = block.originalItems.find(oi => currentStart >= oi.start && currentStart < oi.end)
          || block.originalItems[0];

        allSlots.push({
          bookingId: original.bookingId,
          bookingItemId: original.id,
          courtId: block.courtId,
          courtName: block.courtName,
          date: block.date,
          startTime: this.formatMinutesToTime(currentStart),
          endTime: this.formatMinutesToTime(playEnd),
          totalEndTime: this.formatMinutesToTime(totalEnd),
        });

        currentStart += slotDuration;
      }
    }

    if (allSlots.length === 0) {
      throw new BadRequestException('Không tìm thấy slot sân nào khả dụng. Vui lòng kiểm tra lại trạng thái Booking (chờ thanh toán hoặc đã hủy) hoặc khung giờ thi đấu (startTime/endTime).');
    }

    // Sort slots chronologically
    allSlots.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return this.parseTimeToMinutes(a.startTime) - this.parseTimeToMinutes(b.startTime);
    });

    // 3. Fetch already scheduled matches to check for conflicts
    const dbScheduledMatches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        bookingItemId: { not: null },
      },
      include: {
        team1: true,
        team2: true,
      },
    });

    const bookingItemRawTimesMap = new Map<string, { startTime: string; endTime: string }>();
    for (const info of live.values()) {
      for (const item of info.items ?? []) {
        bookingItemRawTimesMap.set(item.id, { startTime: item.startTime, endTime: item.endTime });
      }
    }

    const getScheduledMatchTimeRange = (m: any) => {
      if (m.time) {
        const utcStr = new Date(m.time).toISOString();
        const start = this.parseTimeToMinutes(utcStr.slice(11, 16));
        const duration = m.duration ?? dto.matchDurationMinutes;
        return { start, end: start + duration };
      }
      const raw = bookingItemRawTimesMap.get(m.bookingItemId!);
      if (raw) {
        return {
          start: this.parseTimeToMinutes(raw.startTime),
          end: this.parseTimeToMinutes(raw.endTime),
        };
      }
      return null;
    };

    const dbScheduledTimeRanges = dbScheduledMatches.map((m) => {
      return {
        matchId: m.id,
        courtId: m.courtId,
        date: m.time ? new Date(m.time).toISOString().slice(0, 10) : null,
        range: getScheduledMatchTimeRange(m),
      };
    }).filter(x => x.range != null);

    const isSlotOccupiedInDb = (slot: any) => {
      return dbScheduledTimeRanges.some((dbm) => {
        // Find if the court and date match
        const dbmItem = dbScheduledMatches.find(m => m.id === dbm.matchId);
        // We match by court UUID derived from the bookingItem
        const dbmItemInfo = dbmItem ? bookingItemRawTimesMap.get(dbmItem.bookingItemId!) : null;
        const dbmCourtId = dbmItem && dbmItem.bookingItemId ? synced.data.flatMap(b => live.get(b.externalBookingId)?.items ?? []).find(i => i.id === dbmItem.bookingItemId)?.courtId : null;

        if (dbmCourtId === slot.courtId && dbm.date === slot.date) {
          const slotStart = this.parseTimeToMinutes(slot.startTime);
          const slotEnd = this.parseTimeToMinutes(slot.endTime);
          return !(slotStart >= dbm.range!.end || dbm.range!.start >= slotEnd);
        }
        return false;
      });
    };

    let availableSlots = allSlots.filter((slot) => !isSlotOccupiedInDb(slot));

    if (availableSlots.length < playableMatches.length) {
      const missing = playableMatches.length - availableSlots.length;
      throw new BadRequestException(
        `Không đủ slot đặt sân: Sự kiện có ${playableMatches.length} trận đấu cần xếp lịch, nhưng hiện tại chỉ có ${availableSlots.length} slot khả dụng trên các sân đã chọn. Bạn cần đặt thêm tối thiểu ${missing} slot sân (mỗi slot dài ${slotDuration} phút bao gồm ${dto.matchDurationMinutes} phút thi đấu và ${rest} phút nghỉ) để có thể lập lịch.`,
      );
    }

    // Conflict check function
    const hasTimeConflict = (s1: any, s2: any, minBreak: number): boolean => {
      if (s1.date !== s2.date) return false;
      const start1 = this.parseTimeToMinutes(s1.startTime);
      const end1 = this.parseTimeToMinutes(s1.endTime);
      const start2 = this.parseTimeToMinutes(s2.startTime);
      const end2 = this.parseTimeToMinutes(s2.endTime);
      return !(start1 >= end2 + minBreak || start2 >= end1 + minBreak);
    };

    // Tracks court assignment counts for the "balanced" strategy
    const courtUsage = new Map<string, number>();
    for (const slot of allSlots) {
      if (!courtUsage.has(slot.courtName)) {
        courtUsage.set(slot.courtName, 0);
      }
    }

    const getSlotForMatch = (m: any) => {
      if (m.time) {
        const date = new Date(m.time).toISOString().slice(0, 10);
        const startMins = this.parseTimeToMinutes(new Date(m.time).toISOString().slice(11, 16));
        const duration = m.duration ?? dto.matchDurationMinutes;
        return {
          date,
          startTime: this.formatMinutesToTime(startMins),
          endTime: this.formatMinutesToTime(startMins + duration),
        };
      }
      const raw = bookingItemRawTimesMap.get(m.bookingItemId!);
      if (raw && m.bookingId) {
        const mirror = mirrors.find(mirror => mirror.id === m.bookingId);
        const date = mirror?.date ? new Date(mirror.date).toISOString().slice(0, 10) : '';
        return {
          date,
          startTime: raw.startTime.slice(0, 5),
          endTime: raw.endTime.slice(0, 5),
        };
      }
      return null;
    };

    const assignments: { match: any; slot: any }[] = [];
    const usedSlotKeys = new Set<string>();

    for (const match of playableMatches) {
      const matchPlayers = this.getMatchPlayerIds(match);

      // Find all scheduled matches for these players in the DB
      const dbPlayerMatches = dbScheduledMatches.filter((m) => {
        const pids = this.getMatchPlayerIds(m);
        return pids.some((id) => matchPlayers.includes(id));
      });

      // Find all scheduled matches for these players in the current in-memory run
      const runPlayerMatches = assignments.filter((a) => {
        const pids = this.getMatchPlayerIds(a.match);
        return pids.some((id) => matchPlayers.includes(id));
      });

      // Filter eligible slots for this match (only unused slots)
      let eligibleSlots = availableSlots.filter((slot) => {
        const key = `${slot.courtId}_${slot.date}_${slot.startTime}`;
        return !usedSlotKeys.has(key);
      });

      if (eligibleSlots.length === 0) continue;

      const playerScheduledSlots = [
        ...dbPlayerMatches.map(getSlotForMatch),
        ...runPlayerMatches.map((a) => a.slot),
      ].filter(Boolean) as any[];

      // 1. Try to find slots that respect the rest duration threshold
      const restThreshold = dto.restDurationMinutes ?? 15;
      let candidateSlots = eligibleSlots.filter((slot) => {
        return !playerScheduledSlots.some((otherSlot) => hasTimeConflict(slot, otherSlot, restThreshold));
      });

      // 2. Fall back to slots that have no overlap (minBreak = 0) if no slots with rest are found
      if (candidateSlots.length === 0) {
        candidateSlots = eligibleSlots.filter((slot) => {
          return !playerScheduledSlots.some((otherSlot) => hasTimeConflict(slot, otherSlot, 0));
        });
      }

      // If still 0, we do not abort or skip; we schedule despite the player overlap
      if (candidateSlots.length > 0) {
        eligibleSlots = candidateSlots;
      }

      // Select the best slot based on optimization strategy
      let selectedSlot: any;

      if (dto.optimizationCriteria === OptimizationCriteria.BALANCED) {
        // Find earliest available time window
        const earliestDate = eligibleSlots[0].date;
        const earliestTime = eligibleSlots[0].startTime;
        const sameWindowSlots = eligibleSlots.filter(
          (s) => s.date === earliestDate && s.startTime === earliestTime,
        );
        sameWindowSlots.sort(
          (a, b) => (courtUsage.get(a.courtName) || 0) - (courtUsage.get(b.courtName) || 0),
        );
        selectedSlot = sameWindowSlots[0];
      } else {
        // 'fastest': Pick the earliest slot chronologically
        selectedSlot = eligibleSlots[0];
      }

      // Assign the match to the selected slot
      assignments.push({ match, slot: selectedSlot });
      const key = `${selectedSlot.courtId}_${selectedSlot.date}_${selectedSlot.startTime}`;
      usedSlotKeys.add(key);
      courtUsage.set(selectedSlot.courtName, (courtUsage.get(selectedSlot.courtName) || 0) + 1);
    }

    // Compute expected completion time (latest endTime of assigned slots)
    let expectedCompletionTime = 'Chưa xác định';
    if (assignments.length > 0) {
      let latestSlot = assignments[0].slot;
      for (const a of assignments) {
        if (a.slot.date > latestSlot.date) {
          latestSlot = a.slot;
        } else if (a.slot.date === latestSlot.date) {
          const latestEnd = this.parseTimeToMinutes(latestSlot.endTime);
          const currentEnd = this.parseTimeToMinutes(a.slot.endTime);
          if (currentEnd > latestEnd) {
            latestSlot = a.slot;
          }
        }
      }
      expectedCompletionTime = latestSlot.endTime;
    }

    const uniqueCourts = new Set(assignments.map((a) => a.slot.courtName));
    const unassignedCount = playableMatches.length - assignments.length;

    const warnings = this.detectPlayerWarnings(assignments, dbScheduledMatches, mirrors, live, Math.max(rest, 15));

    return {
      assignments,
      unassignedCount,
      expectedCompletionTime,
      totalCourtsUsed: uniqueCourts.size,
      warnings,
    };
  }

  async autoScheduleFixturesPreview(
    tournamentId: number,
    eventId: number,
    dto: AutoScheduleConfigDto,
  ) {
    const result = await this.runAutoScheduleEngine(tournamentId, eventId, dto);
    return {
      expectedCompletionTime: result.expectedCompletionTime,
      scheduledMatchesCount: result.assignments.length,
      totalCourtsUsed: result.totalCourtsUsed,
      warnings: result.warnings,
      previewAssignments: result.assignments.map((a) => ({
        matchId: a.match.id,
        round: a.match.round,
        team1Name: a.match.team1?.player1Name ? `${a.match.team1.player1Name}${a.match.team1.player2Name ? '/' + a.match.team1.player2Name : ''}` : 'TBD',
        team2Name: a.match.team2?.player1Name ? `${a.match.team2.player1Name}${a.match.team2.player2Name ? '/' + a.match.team2.player2Name : ''}` : 'TBD',
        courtName: a.slot.courtName,
        date: a.slot.date,
        startTime: a.slot.startTime,
        endTime: a.slot.endTime,
        bookingId: a.slot.bookingId,
        bookingItemId: a.slot.bookingItemId,
      })),
    };
  }

  async confirmAutoScheduleFixtures(
    tournamentId: number,
    eventId: number,
    dto: ConfirmScheduleDto,
  ) {
    const event = await this.prisma.tournamentEvent.findFirst({
      where: { id: eventId, tournamentId },
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found in tournament ${tournamentId}`);
    }

    if (dto.assignments.length === 0) {
      throw new BadRequestException('Danh sách phân bổ trận đấu không được để trống.');
    }

    const bookingIds = Array.from(new Set(dto.assignments.map((a) => a.bookingId)));
    const mirrors = await this.prisma.tournamentBooking.findMany({
      where: { id: { in: bookingIds }, tournamentId },
    });
    if (mirrors.length !== bookingIds.length) {
      throw new BadRequestException('Một hoặc nhiều lượt đặt sân không hợp lệ.');
    }

    const live = await this.sportCenter.getBookingsByIds(mirrors.map((m) => m.externalBookingId));

    const itemMap = new Map<string, { startTime: string; endTime: string; dateYmd: string; mirrorStatus: string; courtId: string; courtName: string }>();
    for (const m of mirrors) {
      const info = live.get(m.externalBookingId);
      if (!info || info.status === 'CANCELLED') continue;
      const dateYmd = m.date ? new Date(m.date).toISOString().slice(0, 10) : '';
      for (const item of info.bookingItems ?? []) {
        itemMap.set(item.id, {
          startTime: item.startTime,
          endTime: item.endTime,
          dateYmd,
          mirrorStatus: m.statusMirror,
          courtId: item.courtId || '',
          courtName: item.courtName || item.courtId || 'Sân đấu',
        });
      }
    }

    const updatedMatches = await this.prisma.$transaction(async (tx) => {
      const assignedSlots = new Set<string>();
      const list = [];
      // Pre-collect all matchIds in this batch so we can exclude them from DB conflict checks
      const batchMatchIds = new Set(dto.assignments.map((a) => a.matchId));

      for (const a of dto.assignments) {
        const match = await tx.match.findUnique({
          where: { id: a.matchId, eventId, tournamentId },
          include: { team1: true, team2: true, event: { select: { name: true } } },
        });
        if (!match) {
          throw new BadRequestException(`Không tìm thấy trận đấu với ID ${a.matchId} thuộc sự kiện này.`);
        }

        if (!match.groupStage && event.bracketStatus !== 'locked') {
          throw new BadRequestException('Nhánh đấu (Bracket) phải được khóa trước khi xếp lịch thi đấu.');
        }

        const [oldFixture] = await this.matchView.enrich(tournamentId, [match]);

        const itemInfo = itemMap.get(a.bookingItemId);
        if (!itemInfo) {
          throw new BadRequestException(`Slot đặt sân với ID ${a.bookingItemId} không tồn tại hoặc đã bị hủy.`);
        }
        if (itemInfo.mirrorStatus !== 'CONFIRMED') {
          throw new BadRequestException('Trận đấu chỉ có thể được xếp lịch vào lượt đặt sân đã được xác nhận (CONFIRMED).');
        }

        const matchDuration = a.matchDurationMinutes
          ?? (a.startTime && a.endTime ? (this.parseTimeToMinutes(a.endTime.slice(0, 5)) - this.parseTimeToMinutes(a.startTime.slice(0, 5))) : null)
          ?? (match as any).duration
          ?? 45;
        const startTimeStr = a.startTime ? a.startTime.slice(0, 5) : null;
        const matchStartTimeStr = startTimeStr || itemInfo.startTime.slice(0, 5);

        const key = `${a.bookingItemId}_${matchStartTimeStr}`;
        if (assignedSlots.has(key)) {
          throw new BadRequestException(`Slot đặt sân ${a.bookingItemId} tại thời điểm ${matchStartTimeStr} bị trùng lặp cho nhiều trận đấu trong danh sách.`);
        }
        assignedSlots.add(key);

        const matchStartMins = this.parseTimeToMinutes(matchStartTimeStr);

        const itemStartMins = this.parseTimeToMinutes(itemInfo.startTime);
        const itemEndMins = this.parseTimeToMinutes(itemInfo.endTime);
        const itemDuration = itemEndMins - itemStartMins;
        if (itemDuration < matchDuration) {
          throw new BadRequestException(`Thời lượng của slot đặt sân (${itemDuration} phút) không đủ cho thời lượng trận đấu (tối thiểu ${matchDuration} phút).`);
        }

        // Check for time overlap on the same court in other database matches
        // Exclude ALL matches in this batch (not just the current one) to prevent false positives on retry
        const allDbMatches = await tx.match.findMany({
          where: {
            tournamentId,
            bookingItemId: { not: null },
            id: { notIn: Array.from(batchMatchIds) },
          },
        });

        const matchEndMins = matchStartMins + matchDuration;

        const clashingMatch = allDbMatches.find((dbm) => {
          const dbmItem = itemMap.get(dbm.bookingItemId!);
          if (dbmItem && dbmItem.courtId === itemInfo.courtId && dbmItem.dateYmd === itemInfo.dateYmd) {
            const dbmStart = dbm.time
              ? this.parseTimeToMinutes(new Date(dbm.time).toISOString().slice(11, 16))
              : this.parseTimeToMinutes(dbmItem.startTime);
            const dbmDuration = dbm.duration ?? 45;
            const dbmEnd = dbmStart + dbmDuration;
            // No overlap if: new match starts at/after DB match ends, OR new match ends at/before DB match starts
            return !(matchStartMins >= dbmEnd || matchEndMins <= dbmStart);
          }
          return false;
        });

        if (clashingMatch) {
          throw new BadRequestException(`Sân đấu/khung giờ đã được gán cho trận đấu khác có ID ${clashingMatch.id}.`);
        }

        const updated = await tx.match.update({
          where: { id: a.matchId },
          data: {
            bookingId: a.bookingId,
            bookingItemId: a.bookingItemId,
            duration: matchDuration,
            time: new Date(`${itemInfo.dateYmd}T${matchStartTimeStr}:00.000Z`),
          },
          include: { team1: true, team2: true, event: { select: { name: true } } },
        });

        if (updated.externalMatchId) {
          void this.match.updateMatch(updated.externalMatchId, {
            scheduledAt: updated.time!.toISOString(),
            courtId: itemInfo.courtId,
          });
        }

        const [newFixture] = await this.matchView.enrich(tournamentId, [updated]);

        await tx.auditLog.create({
          data: {
            tournamentId,
            action: 'FIXTURE_SCHEDULE',
            oldValue: oldFixture as any,
            newValue: newFixture as any,
          },
        });

        void this.handleCourtChangeNotification(oldFixture, newFixture, tournamentId);

        list.push(updated);
      }

      return list;
    });

    void this.handleScheduleReadyNotification(tournamentId, eventId);

    const rest = 15;
    const finalWarnings = this.detectPlayerWarnings(
      updatedMatches.map(m => {
        const utcStr = new Date(m.time!).toISOString();
        const startMins = this.parseTimeToMinutes(utcStr.slice(11, 16));
        const duration = m.duration ?? 45;
        return {
          match: m,
          slot: {
            date: utcStr.slice(0, 10),
            startTime: utcStr.slice(11, 16),
            endTime: this.formatMinutesToTime(startMins + duration),
          }
        };
      }),
      await this.prisma.match.findMany({
        where: { tournamentId, id: { notIn: updatedMatches.map(m => m.id) }, bookingItemId: { not: null } },
        include: { team1: true, team2: true }
      }),
      mirrors,
      live,
      rest
    );

    const enriched = await this.matchView.enrich(tournamentId, updatedMatches);

    return {
      success: true,
      message: `Đã lưu lịch thi đấu chính thức cho ${enriched.length} trận đấu.`,
      scheduledMatchesCount: enriched.length,
      matches: enriched,
      warnings: finalWarnings,
    };
  }

  async validateSchedule(
    tournamentId: number,
    eventId: number,
    dto: ConfirmScheduleDto,
  ) {
    const event = await this.prisma.tournamentEvent.findFirst({
      where: { id: eventId, tournamentId },
    });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found in tournament ${tournamentId}`);
    }

    if (dto.assignments.length === 0) {
      return { warnings: [] };
    }

    const bookingIds = Array.from(new Set(dto.assignments.map((a) => a.bookingId)));
    const mirrors = await this.prisma.tournamentBooking.findMany({
      where: { id: { in: bookingIds }, tournamentId },
    });

    const live = await this.sportCenter.getBookingsByIds(mirrors.map((m) => m.externalBookingId));

    const dbScheduledMatches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        bookingItemId: { not: null },
      },
      include: {
        team1: true,
        team2: true,
      },
    });

    const bookingItemRawTimesMap = new Map<string, { startTime: string; endTime: string }>();
    for (const m of mirrors) {
      const info = live.get(m.externalBookingId);
      if (!info || info.status === 'CANCELLED') continue;
      for (const item of info.bookingItems ?? []) {
        bookingItemRawTimesMap.set(item.id, { startTime: item.startTime, endTime: item.endTime });
      }
    }

    // Build synthetic assignment list
    const assignments: { match: any; slot: any }[] = [];
    for (const a of dto.assignments) {
      const match = await this.prisma.match.findFirst({
        where: { id: a.matchId, eventId, tournamentId },
        include: { team1: true, team2: true },
      });
      if (!match) continue;

      const raw = bookingItemRawTimesMap.get(a.bookingItemId);
      if (!raw) continue;

      const mirror = mirrors.find(m => m.id === a.bookingId);
      const dateYmd = mirror?.date
        ? new Date(mirror.date).toISOString().slice(0, 10)
        : '';

      const startTimeStr = a.startTime ? a.startTime.slice(0, 5) : raw.startTime.slice(0, 5);
      const duration = a.matchDurationMinutes
        ?? (a.startTime && a.endTime ? (this.parseTimeToMinutes(a.endTime.slice(0, 5)) - this.parseTimeToMinutes(a.startTime.slice(0, 5))) : null)
        ?? (match as any).duration
        ?? 45;
      const startMins = this.parseTimeToMinutes(startTimeStr);

      assignments.push({
        match,
        slot: {
          bookingItemId: a.bookingItemId,
          date: dateYmd,
          startTime: startTimeStr,
          endTime: this.formatMinutesToTime(startMins + duration),
        },
      });
    }

    const restThreshold = 15;
    const warnings = this.detectPlayerWarnings(assignments, dbScheduledMatches, mirrors, live, restThreshold);

    return { warnings };
  }

  private async handleScheduleReadyNotification(tournamentId: number, eventId: number) {
    try {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { name: true }
      });
      if (!tournament) return;

      const event = await this.prisma.tournamentEvent.findUnique({
        where: { id: eventId },
        select: { name: true }
      });
      if (!event) return;

      const teams = await this.prisma.team.findMany({
        where: { tournamentId, eventId }
      });

      const playerIds = new Set<string>();
      for (const team of teams) {
        if (team.player1Id) playerIds.add(team.player1Id);
        if (team.player2Id) playerIds.add(team.player2Id);
      }

      const actionUrl = `${this.notificationClient.frontendUrl}/tournaments/${tournamentId}/schedule`;

      // Send email
      for (const playerId of playerIds) {
        const email = await this.notificationClient.getUserEmail(playerId);
        if (!email) continue;

        let name = 'Vận động viên';
        for (const team of teams) {
          if (team.player1Id === playerId) {
            name = team.player1Name;
            break;
          }
          if (team.player2Id === playerId && team.player2Name) {
            name = team.player2Name;
            break;
          }
        }

        void this.notificationClient.sendEmail(
          email,
          'tournament_schedule_ready',
          {
            playerName: name,
            tournamentName: tournament.name,
            actionUrl,
          }
        );
      }

      // Send In-app Notifications
      if (playerIds.size > 0) {
        await this.notificationClient.sendInAppNotification(
          Array.from(playerIds),
          'Lịch thi đấu đã sẵn sàng',
          `Lịch thi đấu nội dung ${event.name} tại giải đấu ${tournament.name} đã được sắp xếp xong.`
        );
      }
    } catch (err) {
      this.logger.error(`Failed to handle schedule ready notification: ${err}`);
    }
  }

  async listBookingItems(tournamentId: number) {
    await this.getTournament(tournamentId);

    const mirrors = await this.prisma.tournamentBooking.findMany({
      where: { tournamentId },
      orderBy: { date: 'asc' },
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

  async getBookedSlots(tournamentId: number, centerId: string, date: string) {
    await this.getTournament(tournamentId);

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

  private detectPlayerWarnings(
    assignments: { match: any; slot: any }[],
    dbScheduledMatches: any[],
    mirrors: any[],
    live: Map<string, any>,
    warningThresholdMinutes: number = 15,
  ): string[] {
    const bookingItemRawTimesMap = new Map<string, { startTime: string; endTime: string }>();
    for (const m of mirrors) {
      const info = live.get(m.externalBookingId);
      if (!info || info.status === 'CANCELLED') continue;
      for (const item of info.bookingItems ?? []) {
        bookingItemRawTimesMap.set(item.id, { startTime: item.startTime, endTime: item.endTime });
      }
    }

    const getSlotForMatch = (m: any) => {
      if (m.time) {
        const date = new Date(m.time).toISOString().slice(0, 10);
        const startMins = this.parseTimeToMinutes(new Date(m.time).toISOString().slice(11, 16));
        const duration = m.duration ?? 45;
        return {
          date,
          startTime: this.formatMinutesToTime(startMins),
          endTime: this.formatMinutesToTime(startMins + duration),
        };
      }
      const raw = bookingItemRawTimesMap.get(m.bookingItemId!);
      if (raw && m.bookingId) {
        const mirror = mirrors.find(mirror => mirror.id === m.bookingId);
        const date = mirror?.date ? new Date(mirror.date).toISOString().slice(0, 10) : '';
        return {
          date,
          startTime: raw.startTime.slice(0, 5),
          endTime: raw.endTime.slice(0, 5),
        };
      }
      return null;
    };

    const allAssigned = [
      ...assignments.map((a) => ({ match: a.match, slot: a.slot })),
      ...dbScheduledMatches
        .map((m) => {
          const slot = getSlotForMatch(m);
          return slot ? { match: m, slot } : null;
        })
        .filter(Boolean) as { match: any; slot: any }[],
    ];

    const playerMatches = new Map<string, { match: any; slot: any }[]>();
    for (const item of allAssigned) {
      const pids = this.getMatchPlayerIds(item.match);
      for (const pid of pids) {
        if (!playerMatches.has(pid)) {
          playerMatches.set(pid, []);
        }
        playerMatches.get(pid)!.push(item);
      }
    }

    const warnings: string[] = [];

    for (const [pid, list] of playerMatches.entries()) {
      list.sort((a, b) => {
        if (a.slot.date !== b.slot.date) return a.slot.date.localeCompare(b.slot.date);
        return this.parseTimeToMinutes(a.slot.startTime) - this.parseTimeToMinutes(b.slot.startTime);
      });

      for (let i = 0; i < list.length - 1; i++) {
        const m1 = list[i];
        const m2 = list[i + 1];

        if (m1.slot.date !== m2.slot.date) continue;

        const end1 = this.parseTimeToMinutes(m1.slot.endTime);
        const start2 = this.parseTimeToMinutes(m2.slot.startTime);
        const gap = start2 - end1;

        const pName = this.getPlayerNameById(m1.match, pid) || 'VĐV';
        if (gap < 0) {
          warnings.push(
            `CRITICAL: Trùng lịch thi đấu! VĐV ${pName} bị xếp lịch thi đấu cùng lúc vào ngày ${m1.slot.date}: Trận #${m1.match.id} (${m1.slot.startTime}-${m1.slot.endTime}) và Trận #${m2.match.id} (${m2.slot.startTime}-${m2.slot.endTime}).`,
          );
        } else if (gap < warningThresholdMinutes) {
          warnings.push(
            `WARNING: Khoảng nghỉ ngắn! VĐV ${pName} thi đấu 2 trận quá gần nhau vào ngày ${m1.slot.date}: Trận #${m1.match.id} (${m1.slot.startTime}-${m1.slot.endTime}) và Trận #${m2.match.id} (${m2.slot.startTime}-${m2.slot.endTime}). Khoảng nghỉ chỉ có ${gap} phút.`,
          );
        }
      }
    }

    // Sort warnings so CRITICAL is always at the top of the array
    warnings.sort((a, b) => {
      const aIsCritical = a.startsWith('CRITICAL:');
      const bIsCritical = b.startsWith('CRITICAL:');
      if (aIsCritical && !bIsCritical) return -1;
      if (!aIsCritical && bIsCritical) return 1;
      return 0;
    });

    return warnings;
  }
}

