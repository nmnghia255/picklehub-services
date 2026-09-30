import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { EventType, MatchStatus, Prisma, type Team } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MatchClient } from '../clients/match.client';
import { SportCenterClient } from '../clients/sport-center.client';
import { AdvancementService } from '../advancement/advancement.service';
import { MatchViewService } from '../common/match-view.service';
import { RecordResultDto } from './dto/record-result.dto';
import { NotificationClient } from '../clients/notification.client';

/** match-service match types we can dispatch a tournament fixture as. */
const MATCH_TYPE: Partial<Record<EventType, 'SINGLES' | 'DOUBLES'>> = {
  [EventType.Singles]: 'SINGLES',
  [EventType.Doubles]: 'DOUBLES',
};

type SkippedFixture = { fixtureId: number; reason: string };

@Injectable()
export class RunService {
  private readonly logger = new Logger(RunService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly match: MatchClient,
    private readonly sportCenter: SportCenterClient,
    private readonly advancement: AdvancementService,
    private readonly matchView: MatchViewService,
    private readonly notificationClient: NotificationClient,
  ) {}

  /** Reload fixtures with their relations and enrich them to the FE Match shape. */
  private async enrichFixtures(tournamentId: number, ids: number[]) {
    if (ids.length === 0) return [];
    const rows = await this.prisma.match.findMany({
      where: { id: { in: ids }, tournamentId },
      include: { team1: true, team2: true, event: { select: { name: true } } },
      orderBy: { id: 'asc' },
    });
    return this.matchView.enrich(tournamentId, rows);
  }

  // #region Helpers

  private async getTournament(tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException(`Tournament ${tournamentId} not found`);
    return tournament;
  }

  private async getFixture(tournamentId: number, fixtureId: number) {
    const fixture = await this.prisma.match.findFirst({ where: { id: fixtureId, tournamentId } });
    if (!fixture) throw new NotFoundException(`Fixture ${fixtureId} not found in tournament ${tournamentId}`);
    return fixture;
  }

  /** Flatten a team into its player UUIDs (singles → one, doubles → two). */
  private players(team: Team | null): string[] {
    if (!team) return [];
    return [team.player1Id, team.player2Id].filter((id): id is string => !!id);
  }

  /** Combine a booking date (ISO) with an "HH:MM" slot start into an ISO timestamp. */
  private toScheduledAt(date: string, startTime: string): string {
    const ymd = new Date(date).toISOString().slice(0, 10);
    const hhmm = startTime.slice(0, 5);
    return `${ymd}T${hhmm}:00.000Z`;
  }

  /** Map a match-service winner (TEAM_A/TEAM_B) to the local winning team id. */
  private winnerTeamId(winner: string | null | undefined, fixture: { team1Id: number | null; team2Id: number | null }): number | null {
    if (winner === 'TEAM_A') return fixture.team1Id;
    if (winner === 'TEAM_B') return fixture.team2Id;
    return null;
  }

  // #endregion

  /**
   * Push every ready fixture (real pairing, scheduled onto a court, not yet dispatched)
   * into match-service as TOURNAMENT matches, tagged with the tournament's cross-service
   * uuid. Stores the returned match id on each fixture. Idempotent: an already-dispatched
   * fixture (with an `externalMatchId`) is skipped, so re-running only picks up new ones.
   */
  async dispatchFixtures(tournamentId: number, callerId: string, eventId?: number, authHeader?: string) {
    const tournament = await this.getTournament(tournamentId);

    const where: Prisma.MatchWhereInput = {
      tournamentId,
      externalMatchId: null,
      team1Id: { not: null },
      team2Id: { not: null },
      bookingItemId: { not: null },
      status: { in: [MatchStatus.scheduled, MatchStatus.ready] },
    };
    if (eventId) where.eventId = eventId;

    const fixtures = await this.prisma.match.findMany({
      where,
      include: { team1: true, team2: true, event: true },
      orderBy: { id: 'asc' },
    });
    if (fixtures.length === 0) {
      return { dispatched: 0, skipped: [] as SkippedFixture[], fixtures: [] };
    }

    // Resolve each fixture's booking slot to a real court + start time.
    const bookingIds = [...new Set(fixtures.map((f) => f.bookingId).filter((id): id is number => id != null))];
    const mirrors = await this.prisma.tournamentBooking.findMany({ where: { id: { in: bookingIds } } });
    const externalByLocal = new Map(mirrors.map((m) => [m.id, m.externalBookingId]));
    const live = await this.sportCenter.getBookingsByIds([...externalByLocal.values()]);

    const skipped: SkippedFixture[] = [];
    const items: any[] = [];
    const dispatchable: typeof fixtures = [];

    for (const f of fixtures) {
      const matchType = MATCH_TYPE[f.event.type];
      if (!matchType) {
        skipped.push({ fixtureId: f.id, reason: `event type ${f.event.type} is not supported for dispatch yet` });
        continue;
      }

      const externalBookingId = f.bookingId != null ? externalByLocal.get(f.bookingId) : undefined;
      const info = externalBookingId ? live.get(externalBookingId) : undefined;
      const item = info?.bookingItems?.find((i: any) => i.id === f.bookingItemId);
      if (!item?.courtId || !info?.date) {
        skipped.push({ fixtureId: f.id, reason: 'booked slot no longer resolves to a court' });
        continue;
      }

      const teamA = this.players(f.team1);
      const teamB = this.players(f.team2);
      const ok = matchType === 'SINGLES' ? teamA.length === 1 && teamB.length === 1 : teamA.length === 2 && teamB.length === 2;
      if (!ok) {
        skipped.push({ fixtureId: f.id, reason: `team roster does not fit a ${matchType} match` });
        continue;
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(item.courtId)) {
        skipped.push({ fixtureId: f.id, reason: `courtId '${item.courtId}' is not a valid UUID` });
        continue;
      }

      const invalidPlayerA = teamA.find((p) => !uuidRegex.test(p));
      const invalidPlayerB = teamB.find((p) => !uuidRegex.test(p));
      if (invalidPlayerA || invalidPlayerB) {
        skipped.push({
          fixtureId: f.id,
          reason: `team roster contains invalid UUID player ID(s): ${invalidPlayerA || invalidPlayerB}`,
        });
        continue;
      }

      if (f.refereeId && !uuidRegex.test(f.refereeId)) {
        skipped.push({ fixtureId: f.id, reason: `refereeId '${f.refereeId}' is not a valid UUID` });
        continue;
      }

      const scheduledAt = f.time ? f.time.toISOString() : this.toScheduledAt(info.date, item.startTime);
      items.push({
        matchType,
        scheduledAt,
        courtId: item.courtId,
        teamA,
        teamB,
        refereeId: f.refereeId ?? undefined,
      });
      dispatchable.push(f);
    }

    if (items.length === 0) {
      return { dispatched: 0, skipped, fixtures: [] };
    }

    const created = await this.match.createBatch({
      tournamentId: tournament.uuid,
      createdById: callerId,
      matches: items,
    });
    if (created.length !== items.length) {
      throw new BadRequestException('The match service did not accept the fixture batch.');
    }

    // The batch preserves input order — zip each fixture to its new match id.
    const updated = await this.prisma.$transaction(
      dispatchable.map((f, i) =>
        this.prisma.match.update({
          where: { id: f.id },
          data: { externalMatchId: created[i].id, status: MatchStatus.ready },
        }),
      ),
    );

    const enriched = await this.enrichFixtures(tournamentId, updated.map((m) => m.id));

    // Fire-and-forget match reminders
    void this.handleMatchReminderNotifications(enriched, tournamentId);

    return {
      dispatched: updated.length,
      skipped,
      fixtures: enriched,
    };
  }

  private async handleMatchReminderNotifications(fixtures: any[], tournamentId: number) {
    try {
      const tournament = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { name: true }
      });
      if (!tournament) return;

      for (const f of fixtures) {
        const teamIds = [f.team1?.teamId, f.team2?.teamId].filter((id): id is number => id != null);
        if (teamIds.length === 0) continue;

        const teams = await this.prisma.team.findMany({
          where: { id: { in: teamIds } }
        });

        const team1 = teams.find(t => t.id === f.team1?.teamId);
        const team2 = teams.find(t => t.id === f.team2?.teamId);

        const team1Name = team1 ? (team1.player2Name ? `${team1.player1Name} / ${team1.player2Name}` : team1.player1Name) : 'Chưa xác định';
        const team2Name = team2 ? (team2.player2Name ? `${team2.player1Name} / ${team2.player2Name}` : team2.player1Name) : 'Chưa xác định';

        const courtName = f.court ?? 'Chưa xếp sân';
        
        let timeStr = 'Chưa xác định';
        if (f.bookingId && f.bookingItemId) {
          const mirror = await this.prisma.tournamentBooking.findFirst({
            where: { id: f.bookingId }
          });
          if (mirror) {
            const live = await this.sportCenter.getBookingsByIds([mirror.externalBookingId]);
            const info = live.get(mirror.externalBookingId);
            const item = info?.bookingItems?.find((i: any) => i.id === f.bookingItemId);
            if (info?.date) {
              const ymd = new Date(info.date).toISOString().slice(0, 10);
              const hhmm = item?.startTime ? item.startTime.slice(0, 5) : '';
              timeStr = hhmm ? `${ymd} ${hhmm}` : ymd;
            }
          }
        }

        const actionUrl = `${this.notificationClient.frontendUrl}/tournaments/${tournamentId}/schedule`;
        const allPlayerIds: string[] = [];

        // Notify Team 1 players
        if (team1) {
          const playerIds = [team1.player1Id, team1.player2Id].filter((id): id is string => !!id);
          allPlayerIds.push(...playerIds);
          for (const playerId of playerIds) {
            const email = await this.notificationClient.getUserEmail(playerId);
            if (!email) continue;
            const name = playerId === team1.player1Id ? team1.player1Name : (team1.player2Name ?? '');

            void this.notificationClient.sendEmail(
              email,
              'tournament_match_reminder',
              {
                playerName: name,
                tournamentName: tournament.name,
                actionUrl,
              }
            );
          }
        }

        // Notify Team 2 players
        if (team2) {
          const playerIds = [team2.player1Id, team2.player2Id].filter((id): id is string => !!id);
          allPlayerIds.push(...playerIds);
          for (const playerId of playerIds) {
            const email = await this.notificationClient.getUserEmail(playerId);
            if (!email) continue;
            const name = playerId === team2.player1Id ? team2.player1Name : (team2.player2Name ?? '');

            void this.notificationClient.sendEmail(
              email,
              'tournament_match_reminder',
              {
                playerName: name,
                tournamentName: tournament.name,
                actionUrl,
              }
            );
          }
        }

        // Send In-app Notifications
        if (allPlayerIds.length > 0) {
          await this.notificationClient.sendInAppNotification(
            allPlayerIds,
            'Nhắc lịch thi đấu',
            `Trận đấu vòng ${f.round ?? 'thi đấu'} của bạn tại giải đấu ${tournament.name} sắp diễn ra. Vui lòng di chuyển ra sân.`
          );
        }
      }
    } catch (err) {
      this.logger.error(`Failed to handle match reminder notifications: ${err}`);
    }
  }

  /**
   * Confirm a fixture's result through match-service (the organizer is the match host)
   * and mirror the confirmed outcome back onto the local fixture. Winner propagation to
   * the next round is handled separately by the advancement flow.
   */
  async recordResult(tournamentId: number, fixtureId: number, dto: RecordResultDto, callerId: string, authHeader?: string) {
    const fixture = await this.getFixture(tournamentId, fixtureId);
    if (!fixture.externalMatchId) {
      throw new BadRequestException('Fixture has not been dispatched to the match service yet.');
    }

    const body: Record<string, unknown> = {};
    if (dto.winner === 1) body.winner = 'TEAM_A';
    else if (dto.winner === 2) body.winner = 'TEAM_B';
    if (dto.scoreA !== undefined) body.scoreA = dto.scoreA;
    if (dto.scoreB !== undefined) body.scoreB = dto.scoreB;
    if (dto.sets !== undefined) body.sets = dto.sets;

    const confirmed = await this.match.overrideResult(fixture.externalMatchId, body);
    if (!confirmed) {
      throw new BadRequestException('The match service rejected the result override.');
    }

    if (confirmed.status !== 'CONFIRMED') {
      // Partial confirmation — leave the fixture as-is and report the live state.
      const [view] = await this.enrichFixtures(tournamentId, [fixture.id]);
      return { fixture: view, match: { status: confirmed.status } };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.match.update({
        where: { id: fixture.id },
        data: {
          winner: this.winnerTeamId(confirmed.winner, fixture),
          score: this.scoreString(confirmed, fixture.score),
          status: MatchStatus.completed,
        },
      });
      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'MATCH_RESULT_RECORD',
          oldValue: fixture as any,
          newValue: u as any,
        },
      });
      return u;
    });

    await this.advancement.onFixtureCompleted(updated.id);
    const [view] = await this.enrichFixtures(tournamentId, [updated.id]);
    return { fixture: view, match: { status: confirmed.status, winner: confirmed.winner, scoreA: confirmed.scoreA, scoreB: confirmed.scoreB } };
  }

  /**
   * Pull every match for this tournament from match-service and reconcile the
   * local fixtures, mirroring status (LIVE -> in_progress, CONFIRMED -> completed) and detailed scores.
   */
  async syncResults(tournamentId: number) {
    const tournament = await this.getTournament(tournamentId);
    const matches = await this.match.listByTournament(tournament.uuid);
    if (matches.length === 0) {
      return { synced: 0, fixtures: [] };
    }

    const byExternal = new Map<string, any>(matches.map((m: any) => [m.id, m]));
    const fixtures = await this.prisma.match.findMany({
      where: { tournamentId, externalMatchId: { in: [...byExternal.keys()] } },
      orderBy: { id: 'asc' },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedMatches = [];
      for (const f of fixtures) {
        const m = byExternal.get(f.externalMatchId!);
        if (!m) continue;

        let localStatus = f.status;
        if (m.status === 'CONFIRMED') {
          localStatus = MatchStatus.completed;
        } else if (m.status === 'LIVE' || m.status === 'PENDING_CONFIRM') {
          localStatus = MatchStatus.in_progress;
        } else if (m.status === 'SCHEDULED') {
          localStatus = MatchStatus.ready;
        }

        const winner = this.winnerTeamId(m.winner, f);
        const score = this.scoreString(m, f.score);
        if (f.status === localStatus && f.winner === winner && f.score === score) continue;

        const u = await tx.match.update({
          where: { id: f.id },
          data: { winner, score, status: localStatus },
        });

        await tx.auditLog.create({
          data: {
            tournamentId,
            action: 'MATCH_RESULT_SYNC',
            oldValue: f as any,
            newValue: u as any,
          },
        });
        updatedMatches.push(u);
      }
      return updatedMatches;
    });

    // Advance round by round (ids ascend by round) once the mirror is settled.
    for (const m of result) {
      if (m.status === MatchStatus.completed) {
        await this.advancement.onFixtureCompleted(m.id);
      }
    }
    return {
      synced: result.length,
      fixtures: await this.enrichFixtures(tournamentId, result.map((m) => m.id)),
    };
  }

  // #region Mirror helpers

  private scoreString(m: { scoreA?: number | null; scoreB?: number | null; sets?: any }, fallback: string | null): string | null {
    if (Array.isArray(m.sets) && m.sets.length > 0) {
      return m.sets
        .map((set: any) => {
          if (Array.isArray(set) && set.length === 2) {
            return `${set[0]}-${set[1]}`;
          }
          return '';
        })
        .filter(Boolean)
        .join(', ');
    }
    return m.scoreA != null && m.scoreB != null ? `${m.scoreA}-${m.scoreB}` : fallback;
  }

  private async mirrorConfirmed(fixture: { id: number; team1Id: number | null; team2Id: number | null; score: string | null }, m: any) {
    return this.prisma.match.update({
      where: { id: fixture.id },
      data: {
        winner: this.winnerTeamId(m.winner, fixture),
        score: this.scoreString(m, fixture.score),
        status: MatchStatus.completed,
      },
    });
  }

  // #endregion
}
