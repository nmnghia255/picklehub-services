import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Team } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RATING_PROVIDER, type RatingProvider } from './rating/rating-provider.interface';
import { ReorderSeedsDto } from './dto/reorder-seeds.dto';
import { SeedListResponseDto, SeedResponseDto } from './dto/seed-response.dto';

const LOCKED = 'locked';
const UNLOCKED = 'unlocked';

@Injectable()
export class SeedingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RATING_PROVIDER) private readonly rating: RatingProvider,
  ) {}

  // #region Helpers

  private async verifyEvent(tournamentId: number, eventId: number) {
    const event = await this.prisma.tournamentEvent.findFirst({
      where: { id: eventId, tournamentId },
    });
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found in tournament ${tournamentId}`);
    }
    return event;
  }

  private teamName(team: Team): string {
    return team.player2Name ? `${team.player1Name} / ${team.player2Name}` : team.player1Name;
  }

  private mapSeed(s: {
    seed: number;
    teamId: number;
    teamName: string;
    rating: number;
    wins: number;
    losses: number;
    status: string;
  }): SeedResponseDto {
    return {
      seed: s.seed,
      teamId: s.teamId,
      team: s.teamName,
      rating: s.rating,
      wins: s.wins,
      losses: s.losses,
      status: s.status,
    };
  }

  // #endregion

  /**
   * Rank the event's approved teams by rating (desc, ties broken by team id) and
   * (re)write the `Seed` rows as `unlocked`. Blocked once the seeding is locked.
   */
  async generate(tournamentId: number, eventId: number): Promise<SeedListResponseDto> {
    await this.verifyEvent(tournamentId, eventId);

    const existing = await this.prisma.seed.findMany({ where: { tournamentId, eventId } });
    if (existing.some((s) => s.status === LOCKED)) {
      throw new BadRequestException('Seeding is locked; unlock or regenerate is not allowed.');
    }

    const teams = await this.prisma.team.findMany({ where: { tournamentId, eventId } });
    if (teams.length === 0) {
      throw new BadRequestException('No approved teams to seed for this event.');
    }

    const ranked = [...teams].sort(
      (a, b) => this.rating.getTeamRating(b) - this.rating.getTeamRating(a) || a.id - b.id,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.seed.deleteMany({ where: { tournamentId, eventId } });
      const seedData = ranked.map((team, i) => ({
        tournamentId,
        eventId,
        seed: i + 1,
        teamId: team.id,
        teamName: this.teamName(team),
        rating: this.rating.getTeamRating(team),
        wins: 0,
        losses: 0,
        status: UNLOCKED,
      }));
      await tx.seed.createMany({ data: seedData });

      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'SEED_GENERATE',
          newValue: { eventId, seeds: seedData } as any,
        },
      });
    });

    return this.list(tournamentId, eventId);
  }

  async list(tournamentId: number, eventId: number): Promise<SeedListResponseDto> {
    await this.verifyEvent(tournamentId, eventId);
    const seeds = await this.prisma.seed.findMany({
      where: { tournamentId, eventId },
      orderBy: { seed: 'asc' },
    });
    return { data: seeds.map((s) => this.mapSeed(s)), meta: { total: seeds.length } };
  }

  /**
   * Batch-apply a new ordering in one transaction. The payload must be a complete
   * permutation of the current seeds (every seeded team, seed numbers 1..n, no dups).
   */
  async reorder(tournamentId: number, eventId: number, dto: ReorderSeedsDto): Promise<SeedListResponseDto> {
    await this.verifyEvent(tournamentId, eventId);

    const seeds = await this.prisma.seed.findMany({ where: { tournamentId, eventId } });
    if (seeds.length === 0) {
      throw new BadRequestException('No seeds to reorder; generate seeds first.');
    }
    if (seeds.some((s) => s.status === LOCKED)) {
      throw new BadRequestException('Seeding is locked; reordering is not allowed.');
    }

    const { seeds: items } = dto;
    if (items.length !== seeds.length) {
      throw new BadRequestException(`Reorder must include all ${seeds.length} seeds.`);
    }

    const teamIds = new Set(seeds.map((s) => s.teamId));
    const seenTeams = new Set<number>();
    const seenPositions = new Set<number>();
    for (const item of items) {
      if (!teamIds.has(item.teamId)) {
        throw new BadRequestException(`Team ${item.teamId} is not seeded in this event.`);
      }
      if (seenTeams.has(item.teamId)) {
        throw new BadRequestException(`Duplicate team ${item.teamId} in reorder.`);
      }
      if (item.seed < 1 || item.seed > seeds.length) {
        throw new BadRequestException(`Seed ${item.seed} is out of range (1..${seeds.length}).`);
      }
      if (seenPositions.has(item.seed)) {
        throw new BadRequestException(`Duplicate seed position ${item.seed} in reorder.`);
      }
      seenTeams.add(item.teamId);
      seenPositions.add(item.seed);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.seed.updateMany({
          where: { tournamentId, eventId, teamId: item.teamId },
          data: { seed: item.seed },
        });
      }
      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'SEED_REORDER',
          oldValue: seeds as any,
          newValue: items as any,
        },
      });
    });

    return this.list(tournamentId, eventId);
  }

  /** Lock the seeding so the bracket can be built from a fixed order. */
  async lock(tournamentId: number, eventId: number): Promise<SeedListResponseDto> {
    await this.verifyEvent(tournamentId, eventId);
    const count = await this.prisma.seed.count({ where: { tournamentId, eventId } });
    if (count === 0) {
      throw new BadRequestException('No seeds to lock; generate seeds first.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.seed.updateMany({
        where: { tournamentId, eventId },
        data: { status: LOCKED },
      });
      await tx.auditLog.create({
        data: {
          tournamentId,
          action: 'SEED_LOCK',
          newValue: { eventId, status: LOCKED } as any,
        },
      });
    });
    return this.list(tournamentId, eventId);
  }
}
