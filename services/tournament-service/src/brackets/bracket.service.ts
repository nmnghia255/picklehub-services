import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BracketResponseDto, BracketMatchDto } from './dto/bracket-response.dto';
import { EditBracketDto } from './dto/edit-bracket.dto';

type Competitor = { teamId: number; teamName: string; seed: number } | null;

@Injectable()
export class BracketService {
  constructor(private readonly prisma: PrismaService) {}

  // #region Bracket math

  /** Smallest power of two >= n (min 2). */
  private nextPow2(n: number): number {
    let p = 1;
    while (p < n) p *= 2;
    return Math.max(p, 2);
  }

  /** Standard single-elimination seed order for a full bracket of `size` slots. */
  private seedSlots(size: number): number[] {
    let slots = [1, 2];
    while (slots.length < size) {
      const n = slots.length * 2;
      const next: number[] = [];
      for (const s of slots) {
        next.push(s);
        next.push(n + 1 - s);
      }
      slots = next;
    }
    return slots;
  }

  /** Human label for a round given how many competitors enter it. */
  private roundLabel(competitors: number): string {
    if (competitors === 2) return 'Final';
    if (competitors === 4) return 'Semifinal';
    if (competitors === 8) return 'Quarterfinal';
    return `Round of ${competitors}`;
  }

  /**
   * Post-processes the competitors array to guarantee that BYE slots are
   * always paired against the top-ranked seeds.
   *
   * Business rule: If there are N BYE slots, they must be awarded to the
   * N teams with the best group-stage performance (Seed 1, Seed 2, …, Seed N),
   * ranked by: Points DESC → GameDiff DESC → Original Seed ASC.
   *
   * This is a safety pass — the standard seedSlots() algorithm already gives
   * BYEs to top seeds for most bracket sizes, but this makes the invariant
   * explicit and resilient to any future algorithm changes.
   */
  private ensureTopSeedsGetByes(competitors: Competitor[]): void {
    const bracketSize = competitors.length;
    const numTeams = competitors.filter((c) => c !== null).length;
    const numByes = bracketSize - numTeams;
    if (numByes === 0) return;

    // The top numByes seeds (seed numbers 1..numByes) must each be paired with a BYE.
    const topSeedNumbers = new Set(Array.from({ length: numByes }, (_, i) => i + 1));

    // Identify which top seeds already have a BYE and which ones do not.
    const topSeedsWithBye = new Set<number>();
    const byePairRealPositions: number[] = []; // positions in competitors[] that hold a real team paired against a BYE

    for (let j = 0; j < bracketSize / 2; j++) {
      const c1 = competitors[2 * j];
      const c2 = competitors[2 * j + 1];
      const isBye = (c1 === null) !== (c2 === null);
      if (!isBye) continue;

      const realPos = c1 !== null ? 2 * j : 2 * j + 1;
      const real = competitors[realPos]!;
      if (topSeedNumbers.has(real.seed)) {
        topSeedsWithBye.add(real.seed);
      } else {
        byePairRealPositions.push(realPos);
      }
    }

    // For each top seed that does NOT have a BYE, swap it with the current
    // real team occupying a BYE-pair slot (which is a non-top seed).
    const topSeedsNeedingBye = Array.from(topSeedNumbers).filter(
      (s) => !topSeedsWithBye.has(s),
    );

    for (const targetSeed of topSeedsNeedingBye) {
      if (byePairRealPositions.length === 0) break;

      // Find the position of this top seed in the competitors array.
      let targetPos = -1;
      for (let i = 0; i < bracketSize; i++) {
        if (competitors[i]?.seed === targetSeed) {
          targetPos = i;
          break;
        }
      }
      if (targetPos === -1) continue;

      // Swap the top seed into the BYE-pair slot, displacing the non-top seed.
      const byeRealPos = byePairRealPositions.shift()!;
      const tmp = competitors[byeRealPos];
      competitors[byeRealPos] = competitors[targetPos];
      competitors[targetPos] = tmp;
    }
  }

  // #endregion

  private async verifyEvent(tournamentId: number, eventId: number) {
    const event = await this.prisma.tournamentEvent.findFirst({
      where: { id: eventId, tournamentId },
    });
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found in tournament ${tournamentId}`);
    }
    return event;
  }

  private teamName(team: { player1Name: string; player2Name: string | null }): string {
    return team.player2Name ? `${team.player1Name} / ${team.player2Name}` : team.player1Name;
  }



  /**
   * Build a seeded single-elimination bracket from the event's **locked** seeds.
   * Pads to the next power of two with byes (top seeds advance automatically), links
   * each match to the one it feeds (`nextMatchId`), and labels rounds.
   */
  async generate(tournamentId: number, eventId: number): Promise<BracketResponseDto> {
    const event = await this.verifyEvent(tournamentId, eventId);

    if (event.bracketStatus === 'locked') {
      throw new BadRequestException('Bracket is locked; regenerate is not allowed.');
    }

    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament || (tournament.status !== 'closed_registration' && tournament.status !== 'in_progress')) {
      throw new BadRequestException('Tournament must be in closed_registration or in_progress status to generate a bracket.');
    }

    if (event.numGroups && event.numGroups > 0) {
      const pendingGroupMatch = await this.prisma.match.findFirst({
        where: {
          tournamentId,
          eventId,
          groupStage: true,
          status: { notIn: [MatchStatus.completed, MatchStatus.walkover] },
        },
      });
      if (pendingGroupMatch) {
        throw new BadRequestException('Vui lòng hoàn thành tất cả các trận đấu vòng bảng trước khi tạo nhánh đấu (bracket).');
      }

      const hasAdvancedTeams = await this.prisma.groupStageMembership.findFirst({
        where: {
          group: { eventId },
          isAdvanced: true,
        },
      });
      if (!hasAdvancedTeams) {
        throw new BadRequestException('Vui lòng thực hiện Advance From Groups để chọn các đội đi tiếp trước khi tạo nhánh đấu (bracket).');
      }
    }

    const seeds = await this.prisma.seed.findMany({
      where: { tournamentId, eventId },
      orderBy: { seed: 'asc' },
    });
    if (seeds.length === 0) {
      throw new BadRequestException('No seeds found; generate and lock seeds first.');
    }
    if (seeds.some((s) => s.status !== 'locked')) {
      throw new BadRequestException('Seeds must be locked before generating the bracket.');
    }
    if (seeds.length < 2) {
      throw new BadRequestException('At least two seeds are required to build a bracket.');
    }

    const existing = await this.prisma.match.findMany({ where: { tournamentId, eventId, groupStage: false } });
    if (existing.some((m) => m.externalMatchId || m.status === 'in_progress' || m.status === 'completed')) {
      throw new BadRequestException('A bracket already exists with started matches; cannot regenerate.');
    }

    const numTeams = seeds.length;
    const bracketSize = this.nextPow2(numTeams);
    const totalRounds = Math.log2(bracketSize);

    const competitors: Competitor[] = this.seedSlots(bracketSize).map((s) =>
      s <= numTeams ? { teamId: seeds[s - 1].teamId, teamName: seeds[s - 1].teamName, seed: s } : null,
    );

    // Guarantee that BYE slots are paired with the top-ranked seeds (Seed 1, Seed 2, …).
    // Business rule: the N teams with best group-stage performance earn automatic advancement.
    this.ensureTopSeedsGetByes(competitors);

    // Same-group separation in the first round (T009, T010)
    const memberships = await this.prisma.groupStageMembership.findMany({
      where: { group: { eventId } },
      include: { group: true },
    });
    const teamToGroupMap = new Map<number, string>(
      memberships.map((m) => [m.teamId, m.group.name]),
    );

    for (let i = 0; i < bracketSize / 2; i++) {
      const c1 = competitors[2 * i];
      const c2 = competitors[2 * i + 1];
      if (!c1 || !c2) continue;

      const g1 = teamToGroupMap.get(c1.teamId);
      const g2 = teamToGroupMap.get(c2.teamId);

      if (g1 && g2 && g1 === g2) {
        let swapped = false;
        for (let k = 0; k < bracketSize / 2; k++) {
          if (k === i) continue;
          const alt_c1 = competitors[2 * k];
          const alt_c2 = competitors[2 * k + 1];
          if (!alt_c1 || !alt_c2) continue;

          const alt_g1 = teamToGroupMap.get(alt_c1.teamId);
          const alt_g2 = teamToGroupMap.get(alt_c2.teamId);

          if (g1 !== alt_g2 && alt_g1 !== g2) {
            competitors[2 * i + 1] = alt_c2;
            competitors[2 * k + 1] = c2;
            swapped = true;
            break;
          }
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.match.deleteMany({ where: { tournamentId, eventId, groupStage: false } });
      await tx.tournamentEvent.update({
        where: { id: eventId },
        data: { bracketStatus: 'unlocked' },
      });

      // Phase 1 — create matches round by round (round 1 first → ids ascend by round).
      const roundIds: number[][] = [];
      for (let r = 1; r <= totalRounds; r++) {
        const matchesInRound = bracketSize / 2 ** r;
        const ids: number[] = [];
        for (let j = 0; j < matchesInRound; j++) {
          const data: Prisma.MatchCreateInput = {
            tournament: { connect: { id: tournamentId } },
            event: { connect: { id: eventId } },
            round: this.roundLabel(matchesInRound * 2),
            bracketPosition: j,
            status: MatchStatus.pending,
          };

          if (r === 1) {
            const c1 = competitors[2 * j];
            const c2 = competitors[2 * j + 1];
            if (c1 && c2) {
              data.team1 = { connect: { id: c1.teamId } };
              data.team2 = { connect: { id: c2.teamId } };
              data.status = MatchStatus.scheduled;
            } else if (c1 || c2) {
              const real = (c1 ?? c2)!;
              data.team1 = { connect: { id: real.teamId } };
              data.winner = real.teamId;
              data.status = MatchStatus.walkover;
            } else {
              data.status = MatchStatus.pending;
            }
          }

          const created = await tx.match.create({ data });
          ids.push(created.id);
        }
        roundIds.push(ids);
      }

      // Phase 2 — link each match to the one it feeds.
      for (let r = 1; r < totalRounds; r++) {
        const ids = roundIds[r - 1];
        const nextIds = roundIds[r];
        for (let j = 0; j < ids.length; j++) {
          await tx.match.update({
            where: { id: ids[j] },
            data: { nextMatchId: nextIds[Math.floor(j / 2)] },
          });
        }
      }

      // Phase 3 — advance bye winners into their next match's slot.
      if (totalRounds > 1) {
        for (let j = 0; j < roundIds[0].length; j++) {
          const c1 = competitors[2 * j];
          const c2 = competitors[2 * j + 1];
          const isBye = (!!c1 && !c2) || (!c1 && !!c2);
          if (!isBye) continue;
          const real = (c1 ?? c2)!;
          const nextMatchId = roundIds[1][Math.floor(j / 2)];
          const slot = j % 2 === 0 ? { team1Id: real.teamId } : { team2Id: real.teamId };
          await tx.match.update({ where: { id: nextMatchId }, data: slot });
        }
      }

      // Any later-round match that ended up with both teams (e.g. two byes meeting) is ready.
      await tx.match.updateMany({
        where: {
          tournamentId,
          eventId,
          team1Id: { not: null },
          team2Id: { not: null },
          winner: null,
          status: MatchStatus.pending,
        },
        data: { status: MatchStatus.scheduled },
      });

      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'BRACKET_GENERATE',
          newValue: { eventId, format: 'single_elimination', matchesCount: seeds.length } as any,
        },
      });
    });

    return this.getBracket(tournamentId, eventId);
  }

  async getBracket(tournamentId: number, eventId: number): Promise<BracketResponseDto> {
    const event = await this.verifyEvent(tournamentId, eventId);

    const [matches, seeds] = await Promise.all([
      this.prisma.match.findMany({
        where: { tournamentId, eventId, groupStage: false },
        orderBy: { id: 'asc' },
        include: { team1: true, team2: true },
      }),
      this.prisma.seed.findMany({ where: { tournamentId, eventId }, select: { teamId: true, seed: true } }),
    ]);

    const seedByTeam = new Map(seeds.map((s) => [s.teamId, s.seed]));

    const data: BracketMatchDto[] = matches.map((m) => ({
      id: m.id,
      round: m.round,
      bracketPosition: m.bracketPosition,
      nextMatchId: m.nextMatchId,
      loserMatchId: m.loserMatchId,
      stage: m.stage,
      externalMatchId: m.externalMatchId,
      status: m.status,
      winner: m.winner == null ? null : m.winner === m.team1Id ? 1 : m.winner === m.team2Id ? 2 : null,
      score: m.score,
      refereeId: m.refereeId,
      refereeName: m.refereeName,
      team1: m.team1
        ? {
            teamId: m.team1.id,
            name: this.teamName(m.team1),
            seed: seedByTeam.get(m.team1.id) ?? null,
            rating: m.team1.avgRating,
            player1: {
              id: m.team1.player1Id,
              name: m.team1.player1Name,
              rating: m.team1.player1Rating,
              gender: m.team1.player1Gender,
              duprId: m.team1.player1DuprId,
            },
            player2: m.team1.player2Id
              ? {
                  id: m.team1.player2Id,
                  name: m.team1.player2Name,
                  rating: m.team1.player2Rating,
                  gender: m.team1.player2Gender,
                  duprId: m.team1.player2DuprId,
                }
              : null,
          }
        : null,
      team2: m.team2
        ? {
            teamId: m.team2.id,
            name: this.teamName(m.team2),
            seed: seedByTeam.get(m.team2.id) ?? null,
            rating: m.team2.avgRating,
            player1: {
              id: m.team2.player1Id,
              name: m.team2.player1Name,
              rating: m.team2.player1Rating,
              gender: m.team2.player1Gender,
              duprId: m.team2.player1DuprId,
            },
            player2: m.team2.player2Id
              ? {
                  id: m.team2.player2Id,
                  name: m.team2.player2Name,
                  rating: m.team2.player2Rating,
                  gender: m.team2.player2Gender,
                  duprId: m.team2.player2DuprId,
                }
              : null,
          }
        : null,
    }));

    return { data, meta: { total: data.length }, status: event.bracketStatus };
  }

  async deleteBracket(tournamentId: number, eventId: number): Promise<{ deleted: number }> {
    const event = await this.verifyEvent(tournamentId, eventId);
    if (event.bracketStatus === 'locked') {
      throw new BadRequestException('Bracket is locked; delete is not allowed.');
    }
    const matches = await this.prisma.match.findMany({ where: { tournamentId, eventId, groupStage: false } });
    if (matches.length === 0) {
      throw new BadRequestException('No bracket to delete for this event.');
    }
    if (matches.some((m) => m.externalMatchId || m.status === 'in_progress' || m.status === 'completed')) {
      throw new BadRequestException('Cannot delete bracket: some matches have already started.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.match.deleteMany({ where: { tournamentId, eventId, groupStage: false } });
      await tx.tournamentEvent.update({
        where: { id: eventId },
        data: { bracketStatus: 'unlocked' },
      });
      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'BRACKET_DELETE',
          oldValue: { eventId, deletedMatchesCount: matches.length } as any,
        },
      });
    });
    return { deleted: matches.length };
  }

  async lockBracket(tournamentId: number, eventId: number): Promise<BracketResponseDto> {
    const event = await this.verifyEvent(tournamentId, eventId);
    const count = await this.prisma.match.count({ where: { tournamentId, eventId } });
    if (count === 0) {
      throw new BadRequestException('No bracket to lock; generate bracket first.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.tournamentEvent.update({
        where: { id: eventId },
        data: { bracketStatus: 'locked' },
      });
      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'BRACKET_LOCK',
          newValue: { eventId, status: 'locked' } as any,
        },
      });
    });
    return this.getBracket(tournamentId, eventId);
  }

  async editBracket(tournamentId: number, eventId: number, dto: EditBracketDto): Promise<BracketResponseDto> {
    const event = await this.verifyEvent(tournamentId, eventId);
    if (event.bracketStatus === 'locked') {
      throw new BadRequestException('Bracket is locked; editing is not allowed.');
    }

    const { matches: matchUpdates } = dto;
    if (matchUpdates.length === 0) {
      return this.getBracket(tournamentId, eventId);
    }

    const matchIds = matchUpdates.map((mu) => mu.id);
    const existingMatches = await this.prisma.match.findMany({
      where: { id: { in: matchIds }, tournamentId, eventId },
    });

    if (existingMatches.length !== matchUpdates.length) {
      throw new BadRequestException('Some match IDs in payload do not exist or do not belong to this event.');
    }

    if (existingMatches.some((m) => m.externalMatchId || m.status === 'in_progress' || m.status === 'completed')) {
      throw new BadRequestException('Cannot edit matches that are in progress or completed.');
    }

    const validTeams = await this.prisma.team.findMany({
      where: { tournamentId, eventId },
      select: { id: true },
    });
    const teamIdsSet = new Set(validTeams.map((t) => t.id));

    for (const update of matchUpdates) {
      if (update.team1Id != null && !teamIdsSet.has(update.team1Id)) {
        throw new BadRequestException(`Team ${update.team1Id} does not belong to this event.`);
      }
      if (update.team2Id != null && !teamIdsSet.has(update.team2Id)) {
        throw new BadRequestException(`Team ${update.team2Id} does not belong to this event.`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const update of matchUpdates) {
        await tx.match.update({
          where: { id: update.id },
          data: {
            team1Id: update.team1Id !== undefined ? update.team1Id : undefined,
            team2Id: update.team2Id !== undefined ? update.team2Id : undefined,
          },
        });
        await this.propagateMatchWinner(tx, update.id);
      }

      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'BRACKET_EDIT',
          oldValue: existingMatches as any,
          newValue: matchUpdates as any,
        },
      });
    });

    return this.getBracket(tournamentId, eventId);
  }

  private async propagateMatchWinner(tx: Prisma.TransactionClient, matchId: number): Promise<void> {
    const match = await tx.match.findUnique({
      where: { id: matchId },
    });
    if (!match) return;

    let winnerId: number | null = null;
    let status: MatchStatus = match.status;

    if (match.status !== MatchStatus.completed && match.status !== MatchStatus.in_progress) {
      const hasTeam1 = match.team1Id != null;
      const hasTeam2 = match.team2Id != null;

      const incomingCount = await tx.match.count({
        where: {
          OR: [
            { nextMatchId: match.id },
            { loserMatchId: match.id }
          ]
        }
      });

      if (incomingCount === 0) {
        if (hasTeam1 && hasTeam2) {
          status = MatchStatus.scheduled;
          winnerId = null;
        } else if (hasTeam1 || hasTeam2) {
          status = MatchStatus.walkover;
          winnerId = (match.team1Id ?? match.team2Id)!;
        } else {
          status = MatchStatus.pending;
          winnerId = null;
        }
      } else {
        if (hasTeam1 && hasTeam2) {
          status = MatchStatus.scheduled;
          winnerId = null;
        } else {
          status = MatchStatus.pending;
          winnerId = null;
        }
      }

      await tx.match.update({
        where: { id: match.id },
        data: { status, winner: winnerId, score: winnerId == null ? null : match.score },
      });
    } else {
      winnerId = match.winner;
    }

    if (match.nextMatchId != null) {
      const nextMatch = await tx.match.findUnique({ where: { id: match.nextMatchId } });
      if (nextMatch) {
        let slot: 'team1' | 'team2' = 'team1';
        if (nextMatch.round === 'Grand Final') {
          if (match.stage === 'Winner Bracket') slot = 'team1';
          else if (match.stage === 'Loser Bracket') slot = 'team2';
        } else if (match.stage === 'Loser Bracket') {
          const roundName = nextMatch.round ?? '';
          const isEvenRound =
            roundName.includes('Round 2') ||
            roundName.includes('Round 4') ||
            roundName.includes('Round 6') ||
            roundName.includes('Final');
          if (isEvenRound) {
            slot = 'team1';
          } else {
            slot = (match.bracketPosition ?? 0) % 2 === 0 ? 'team1' : 'team2';
          }
        } else {
          slot = (match.bracketPosition ?? 0) % 2 === 0 ? 'team1' : 'team2';
        }

        const data = slot === 'team1' ? { team1Id: winnerId } : { team2Id: winnerId };
        await tx.match.update({
          where: { id: nextMatch.id },
          data,
        });

        await this.propagateMatchWinner(tx, nextMatch.id);
      }
    }

    if (match.loserMatchId != null) {
      const loserMatch = await tx.match.findUnique({ where: { id: match.loserMatchId } });
      if (loserMatch) {
        const loserId = winnerId != null ? (winnerId === match.team1Id ? match.team2Id : match.team1Id) : null;
        let slot: 'team1' | 'team2' = 'team1';
        if (match.round === 'Winner Round 1') {
          slot = (match.bracketPosition ?? 0) % 2 === 0 ? 'team1' : 'team2';
        } else {
          slot = 'team2';
        }

        const data = slot === 'team1' ? { team1Id: loserId } : { team2Id: loserId };
        await tx.match.update({
          where: { id: loserMatch.id },
          data,
        });

        await this.propagateMatchWinner(tx, loserMatch.id);
      }
    }
  }
}
