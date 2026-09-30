import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MatchStatus, TournamentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PrizesService } from '../prizes/prizes.service';
import { GroupStageService } from '../group-stage/group-stage.service';
import { StandingsResponseDto, StandingRowDto } from './dto/standings-response.dto';

@Injectable()
export class AdvancementService {
  private readonly logger = new Logger(AdvancementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prizes: PrizesService,
    private readonly groupStageService: GroupStageService,
  ) {}

  // #region Advancement (called when a fixture's result is mirrored)

  /**
   * React to a fixture that just got a confirmed winner: keep the event's win/loss
   * records in step, push the winner into the next round, and — once the final is
   * decided — auto-award prizes and complete the tournament. Idempotent: win/loss is
   * recomputed (not incremented) and the next slot is only filled while it is still
   * waiting, so re-running over the same result is a no-op.
   */
  async onFixtureCompleted(fixtureId: number): Promise<void> {
    const fixture = await this.prisma.match.findUnique({ where: { id: fixtureId } });
    if (!fixture || fixture.winner == null) return;

    if (fixture.groupStage) {
      await this.groupStageService.recomputeGroupStandings(fixture.tournamentId, fixture.eventId);
      return;
    }

    await this.recomputeSeedRecords(fixture.tournamentId, fixture.eventId);

    const event = await this.prisma.tournamentEvent.findFirst({ where: { id: fixture.eventId } });
    if (!event) return;

    await this.pushWinnerToNext(fixture);

    // The final is the bracket root (nothing feeds out of it).
    if (fixture.nextMatchId == null) {
      await this.autoAwardEventPrizes(fixture);
      await this.maybeCompleteTournament(fixture.tournamentId);
    }
  }

  /** Recount every seed's wins/losses from the event's decided matches. */
  private async recomputeSeedRecords(tournamentId: number, eventId: number): Promise<void> {
    const [seeds, decided] = await Promise.all([
      this.prisma.seed.findMany({ where: { tournamentId, eventId } }),
      this.prisma.match.findMany({
        where: { tournamentId, eventId, winner: { not: null } },
        select: { team1Id: true, team2Id: true, winner: true },
      }),
    ]);

    const wins = new Map<number, number>();
    const losses = new Map<number, number>();
    for (const m of decided) {
      if (m.winner != null) wins.set(m.winner, (wins.get(m.winner) ?? 0) + 1);
      const loser = m.winner === m.team1Id ? m.team2Id : m.winner === m.team2Id ? m.team1Id : null;
      if (loser != null) losses.set(loser, (losses.get(loser) ?? 0) + 1);
    }

    await this.prisma.$transaction(
      seeds.map((s) =>
        this.prisma.seed.update({
          where: { id: s.id },
          data: { wins: wins.get(s.teamId) ?? 0, losses: losses.get(s.teamId) ?? 0 },
        }),
      ),
    );
  }

  private async pushTeamToSlot(
    tx: Prisma.TransactionClient,
    matchOrId: any,
    slot: 'team1' | 'team2',
    teamId: number,
  ): Promise<void> {
    const match = typeof matchOrId === 'number'
      ? await tx.match.findUnique({ where: { id: matchOrId } })
      : matchOrId;
    if (!match) return;

    if (match.externalMatchId || match.status === MatchStatus.completed) {
      this.logger.warn(`Match ${match.id} already started/finished; not seeding team.`);
      return;
    }

    const data: any = slot === 'team1' ? { team1Id: teamId } : { team2Id: teamId };

    const t1 = slot === 'team1' ? teamId : match.team1Id;
    const t2 = slot === 'team2' ? teamId : match.team2Id;

    if (t1 != null && t2 != null && match.status === MatchStatus.pending) {
      data.status = MatchStatus.scheduled;
    }

    const updated = await tx.match.update({
      where: { id: match.id },
      data,
    });

    if (updated.stage === 'Loser Bracket' && updated.round === 'Loser Round 1') {
      const pos = updated.bracketPosition ?? 0;
      const otherSlot = slot === 'team1' ? 'team2' : 'team1';
      const otherTeamId = otherSlot === 'team1' ? updated.team1Id : updated.team2Id;

      if (otherTeamId == null) {
        const sourcePos = otherSlot === 'team1' ? 2 * pos : 2 * pos + 1;
        const sourceMatch = await tx.match.findFirst({
          where: {
            eventId: updated.eventId,
            round: 'Winner Round 1',
            bracketPosition: sourcePos,
          },
        });
        if (sourceMatch && sourceMatch.status === MatchStatus.walkover) {
          await tx.match.update({
            where: { id: match.id },
            data: {
              winner: teamId,
              status: MatchStatus.walkover,
            },
          });
          if (updated.nextMatchId != null) {
            await this.pushTeamToSlot(tx, updated.nextMatchId, 'team1', teamId);
          }
        }
      }
    }
  }

  private async routeWinner(
    tx: Prisma.TransactionClient,
    fixture: any,
    nextMatchId: number,
  ): Promise<void> {
    const nextMatch = await tx.match.findUnique({ where: { id: nextMatchId } });
    if (!nextMatch) return;

    let slot: 'team1' | 'team2' = 'team1';
    if (nextMatch.round === 'Grand Final') {
      if (fixture.stage === 'Winner Bracket') {
        slot = 'team1';
      } else if (fixture.stage === 'Loser Bracket') {
        slot = 'team2';
      }
    } else if (fixture.stage === 'Loser Bracket') {
      const roundName = nextMatch.round ?? '';
      const isEvenRound =
        roundName.includes('Round 2') ||
        roundName.includes('Round 4') ||
        roundName.includes('Round 6') ||
        roundName.includes('Final');
      if (isEvenRound) {
        slot = 'team1';
      } else {
        slot = (fixture.bracketPosition ?? 0) % 2 === 0 ? 'team1' : 'team2';
      }
    } else {
      slot = (fixture.bracketPosition ?? 0) % 2 === 0 ? 'team1' : 'team2';
    }

    await this.pushTeamToSlot(tx, nextMatch, slot, fixture.winner!);
  }

  private async routeLoser(
    tx: Prisma.TransactionClient,
    fixture: any,
    loserMatchId: number,
  ): Promise<void> {
    const loser = fixture.winner === fixture.team1Id ? fixture.team2Id : fixture.team1Id;
    if (loser == null) return;

    const loserMatch = await tx.match.findUnique({ where: { id: loserMatchId } });
    if (!loserMatch) return;

    let slot: 'team1' | 'team2' = 'team1';
    if (fixture.round === 'Winner Round 1') {
      slot = (fixture.bracketPosition ?? 0) % 2 === 0 ? 'team1' : 'team2';
    } else {
      slot = 'team2';
    }

    await this.pushTeamToSlot(tx, loserMatch, slot, loser);
  }

  private async pushWinnerToNext(fixture: {
    id: number;
    winner: number | null;
    nextMatchId: number | null;
    loserMatchId?: number | null;
    bracketPosition: number | null;
    stage: string | null;
    round: string | null;
    team1Id: number | null;
    team2Id: number | null;
  }): Promise<void> {
    if (fixture.winner == null) return;

    await this.prisma.$transaction(async (tx) => {
      if (fixture.nextMatchId != null) {
        await this.routeWinner(tx, fixture, fixture.nextMatchId);
      }
      if (fixture.loserMatchId != null) {
        await this.routeLoser(tx, fixture, fixture.loserMatchId);
      }
    });
  }

  /**
   * Fill the event's prizes from the final once it is decided: highest-value prize →
   * champion, next → runner-up. Backs off entirely if any prize for the event has
   * already been awarded, so a manual award always wins.
   */
  private async autoAwardEventPrizes(final: { tournamentId: number; eventId: number; winner: number | null; team1Id: number | null; team2Id: number | null }): Promise<void> {
    const champion = final.winner;
    if (champion == null) return;
    const runnerUp = champion === final.team1Id ? final.team2Id : final.team1Id;

    const prizes = await this.prisma.prize.findMany({ where: { tournamentId: final.tournamentId, eventId: final.eventId } });
    if (prizes.length === 0) return;
    if (prizes.some((p) => p.winnerTeamId != null)) return; // manual award in control

    const ranked = [...prizes].sort((a, b) => b.value - a.value || a.createdAt.getTime() - b.createdAt.getTime());
    const finishers = [champion, runnerUp].filter((x): x is number => x != null);

    for (let i = 0; i < finishers.length && i < ranked.length; i++) {
      await this.prizes.awardPrize(final.tournamentId, ranked[i].id, finishers[i]);
    }
  }



  /** Flip the tournament to completed once every event's final has a winner. */
  private async maybeCompleteTournament(tournamentId: number): Promise<void> {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament || tournament.status !== TournamentStatus.in_progress) return;

    const events = await this.prisma.tournamentEvent.findMany({ where: { tournamentId }, select: { id: true } });
    if (events.length === 0) return;

    for (const e of events) {
      const final = await this.prisma.match.findFirst({ where: { tournamentId, eventId: e.id, nextMatchId: null } });
      if (!final || final.winner == null) return; // an event has no bracket or is unfinished
    }

    await this.prisma.tournament.update({ where: { id: tournamentId }, data: { status: TournamentStatus.completed } });
    this.logger.log(`Tournament ${tournamentId} completed — every event final is decided.`);
  }

  // #endregion

  // #region Standings (read)

  private async verifyEvent(tournamentId: number, eventId: number) {
    const event = await this.prisma.tournamentEvent.findFirst({ where: { id: eventId, tournamentId } });
    if (!event) throw new NotFoundException(`Event ${eventId} not found in tournament ${tournamentId}`);
    return event;
  }

  /** Final placement table for an event, derived from the bracket results. */
  async getStandings(tournamentId: number, eventId: number): Promise<StandingsResponseDto> {
    const event = await this.verifyEvent(tournamentId, eventId);

    const [seeds, matches] = await Promise.all([
      this.prisma.seed.findMany({ where: { tournamentId, eventId }, orderBy: { seed: 'asc' } }),
      this.prisma.match.findMany({
        where: { tournamentId, eventId },
        select: { team1Id: true, team2Id: true, winner: true, round: true, nextMatchId: true, status: true },
      }),
    ]);



    const finalMatch = matches.find((m) => m.nextMatchId == null);
    const championTeamId = finalMatch?.winner ?? null;
    const runnerUpId = finalMatch?.winner != null ? (finalMatch.winner === finalMatch.team1Id ? finalMatch.team2Id : finalMatch.team1Id) : null;

    const rows: Omit<StandingRowDto, 'position'>[] = seeds.map((s) => {
      let wins = 0;
      let losses = 0;
      let eliminatedRound: string | null = null;
      for (const m of matches) {
        const inMatch = m.team1Id === s.teamId || m.team2Id === s.teamId;
        if (!inMatch || m.winner == null) continue;
        if (m.winner === s.teamId) wins++;
        else {
          losses++;
          eliminatedRound = m.round ?? eliminatedRound;
        }
      }

      const result =
        s.teamId === championTeamId
          ? 'Champion'
          : s.teamId === runnerUpId
            ? 'Runner-up'
            : eliminatedRound
              ? `Eliminated — ${eliminatedRound}`
              : 'In progress';

      return { teamId: s.teamId, name: s.teamName, seed: s.seed, wins, losses, result };
    });

    const rank = (r: Omit<StandingRowDto, 'position'>) =>
      r.teamId === championTeamId ? 0 : r.teamId === runnerUpId ? 1 : 2;
    rows.sort((a, b) => rank(a) - rank(b) || b.wins - a.wins || (a.seed ?? 999) - (b.seed ?? 999));

    const championTeamName = championTeamId != null ? (seeds.find((s) => s.teamId === championTeamId)?.teamName ?? null) : null;

    return {
      data: rows.map((r, i) => ({ position: i + 1, ...r })),
      meta: { total: rows.length, championTeamId, championTeamName },
    };
  }

  // #endregion
}
