import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchStatus, Prisma } from '@prisma/client';
import { ConfigureGroupStageDto } from './dto/configure-group-stage.dto';
import { DrawGroupsDto } from './dto/draw-groups.dto';
import { GroupStageGroupResponseDto, GroupStageMembershipResponseDto } from './dto/group-stage-response.dto';
import { UserClient } from '../clients/user.client';
import { NotificationClient } from '../clients/notification.client';
import { EventsService } from '../events/events.service';

const MAX_GROUP_SIZE = 6;

@Injectable()
export class GroupStageService {
  private readonly logger = new Logger(GroupStageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userClient: UserClient,
    private readonly notificationClient: NotificationClient,
    private readonly eventsService: EventsService,
  ) { }

  private async verifyEvent(tournamentId: number, eventId: number) {
    const event = await this.prisma.tournamentEvent.findFirst({
      where: { id: eventId, tournamentId },
    });
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found in tournament ${tournamentId}`);
    }
    return event;
  }

  async configure(tournamentId: number, eventId: number, dto: ConfigureGroupStageDto) {
    const event = await this.verifyEvent(tournamentId, eventId);

    // If groups have already been drawn, don't allow configuration
    const existingGroups = await this.prisma.groupStageGroup.findFirst({
      where: { tournamentId, eventId },
    });
    if (existingGroups) {
      throw new BadRequestException('Cannot configure group stage: groups have already been drawn.');
    }

    // If matches already started, don't allow changing group stage configuration
    const startedMatch = await this.prisma.match.findFirst({
      where: {
        tournamentId,
        eventId,
        status: { in: [MatchStatus.in_progress, MatchStatus.completed] },
      },
    });
    if (startedMatch) {
      throw new BadRequestException('Cannot configure group stage: matches have already started/completed.');
    }

    const numGroups = dto.numGroups ?? 2;
    const totalAdvance = dto.totalAdvance ?? numGroups * 2;

    await this.prisma.tournamentEvent.update({
      where: { id: eventId },
      data: {
        numGroups,
        totalAdvance,
        advanceMethod: dto.advanceMethod ?? 'standard',
      },
    });

    return this.eventsService.findOne(tournamentId, eventId);
  }

  async drawGroups(tournamentId: number, eventId: number, dto: DrawGroupsDto = {}) {
    const event = await this.verifyEvent(tournamentId, eventId);

    const numGroups = event.numGroups ?? 2;

    // Prevent drawing groups if they have already been drawn
    const existingGroups = await this.prisma.groupStageGroup.findFirst({
      where: { tournamentId, eventId },
    });
    if (existingGroups) {
      throw new BadRequestException('Cannot draw groups: groups have already been drawn.');
    }

    // Validate priority teams count (T003)
    if (dto.priorityTeamIds && dto.priorityTeamIds.length > numGroups) {
      throw new BadRequestException(`Number of priority teams cannot exceed the number of groups (${numGroups}) [Hard Limit].`);
    }

    // Check if matches have started
    const startedMatch = await this.prisma.match.findFirst({
      where: {
        tournamentId,
        eventId,
        status: { in: [MatchStatus.in_progress, MatchStatus.completed] },
      },
    });
    if (startedMatch) {
      throw new BadRequestException('Cannot redraw groups: matches have already started/completed.');
    }

    // Get locked seeds/teams
    const seeds = await this.prisma.seed.findMany({
      where: { tournamentId, eventId },
      orderBy: { seed: 'asc' },
    });
    if (seeds.length === 0) {
      throw new BadRequestException('No seeds found. Please generate and lock seeds first.');
    }

    if (seeds.some((s) => s.status !== 'locked')) {
      throw new BadRequestException('Seeds must be locked before drawing groups.');
    }

    // Validate size limit
    if (seeds.length / numGroups > MAX_GROUP_SIZE) {
      throw new BadRequestException(`Group size limit exceeded. Max is ${MAX_GROUP_SIZE} teams per group. Please configure more groups.`);
    }

    // Split seeds into priority and non-priority list (T004)
    const priorityTeamIdsSet = new Set(dto.priorityTeamIds ?? []);
    const prioritySeeds = seeds.filter((s) => priorityTeamIdsSet.has(s.teamId));
    const nonPrioritySeeds = seeds.filter((s) => !priorityTeamIdsSet.has(s.teamId));

    // Construct Pots
    const totalPots = Math.ceil(seeds.length / numGroups);
    const pots: any[][] = Array.from({ length: totalPots }, () => []);

    // Fill Pot 1
    const pCount = prioritySeeds.length;
    pots[0].push(...prioritySeeds);
    const nonPriorityTop = nonPrioritySeeds.slice(0, numGroups - pCount);
    pots[0].push(...nonPriorityTop);

    // Fill remaining Pots
    const remainingNonPriority = nonPrioritySeeds.slice(numGroups - pCount);
    remainingNonPriority.forEach((seed, index) => {
      const potIndex = Math.floor(index / numGroups) + 1;
      if (potIndex < totalPots) {
        pots[potIndex].push(seed);
      } else {
        pots[totalPots - 1].push(seed);
      }
    });

    // Shuffle each Pot (Fisher-Yates)
    const shuffledPots = pots.map((pot) => {
      const p = [...pot];
      for (let i = p.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
      }
      return p;
    });

    // Distribute teams pot-by-pot round-robin (no geographic separation)
    const groupsList: any[][] = Array.from({ length: numGroups }, () => []);

    shuffledPots.forEach((pot) => {
      const groupIndices = Array.from({ length: numGroups }, (_, idx) => idx);
      // Fisher-Yates shuffle the group indices so it is not always Group 0 getting the top seed of the pot
      for (let i = groupIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [groupIndices[i], groupIndices[j]] = [groupIndices[j], groupIndices[i]];
      }

      pot.forEach((seed, idx) => {
        const targetGroupIdx = groupIndices[idx];
        groupsList[targetGroupIdx].push(seed);
      });
    });

    await this.prisma.$transaction(async (tx) => {
      // Delete existing group stage structures (redundant due to guard but kept for tx consistency)
      await tx.groupStageGroup.deleteMany({
        where: { tournamentId, eventId },
      });
      // Delete existing group matches
      await tx.match.deleteMany({
        where: { tournamentId, eventId, groupStage: true },
      });

      // Create groups
      const groupsData = Array.from({ length: numGroups }).map((_, i) => ({
        tournamentId,
        eventId,
        name: `Group ${String.fromCharCode(65 + i)}`,
        order: i,
      }));

      const groups: any[] = [];
      for (const gData of groupsData) {
        const created = await tx.groupStageGroup.create({ data: gData });
        groups.push(created);
      }

      // Save memberships
      const memberships: Prisma.GroupStageMembershipCreateManyInput[] = [];
      groupsList.forEach((groupTeams, groupIndex) => {
        groupTeams.forEach((seed) => {
          memberships.push({
            groupId: groups[groupIndex].id,
            teamId: seed.teamId,
            seed: seed.seed,
            wins: 0,
            draws: 0,
            losses: 0,
            points: 0,
            gameDiff: 0,
            isAdvanced: false,
          });
        });
      });

      await tx.groupStageMembership.createMany({
        data: memberships,
      });
    });

    // Fire-and-forget notification
    void this.handleGroupsDrawnNotification(tournamentId, eventId);

    return this.getGroups(tournamentId, eventId);
  }

  private async handleGroupsDrawnNotification(tournamentId: number, eventId: number) {
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

      const actionUrl = `${this.notificationClient.frontendUrl}/tournaments/${tournamentId}`;

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
          'tournament_groups_drawn',
          {
            playerName: name,
            tournamentName: tournament.name,
            eventName: event.name,
            actionUrl,
          }
        );
      }

      // Send In-app Notifications
      if (playerIds.size > 0) {
        await this.notificationClient.sendInAppNotification(
          Array.from(playerIds),
          'Kết quả bốc thăm chia bảng',
          `Đã có kết quả bốc thăm chia bảng nội dung ${event.name} tại giải đấu ${tournament.name}.`
        );
      }
    } catch (err) {
      this.logger.error(`Failed to handle groups drawn notification: ${err}`);
    }
  }

  async getGroups(tournamentId: number, eventId: number): Promise<GroupStageGroupResponseDto[]> {
    await this.verifyEvent(tournamentId, eventId);

    const groups = await this.prisma.groupStageGroup.findMany({
      where: { tournamentId, eventId },
      orderBy: { order: 'asc' },
      include: {
        memberships: {
          include: {
            team: true,
          },
        },
      },
    });

    return groups.map((g) => {
      // Sort memberships based on standings rules: points DESC -> gameDiff DESC -> original seed ASC
      const sortedMemberships = [...g.memberships].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
        return (a.seed ?? 999) - (b.seed ?? 999);
      });

      return {
        id: g.id,
        name: g.name,
        order: g.order,
        memberships: sortedMemberships.map((m) => ({
          id: m.id,
          groupId: m.groupId,
          teamId: m.teamId,
          teamName: m.team.player2Name ? `${m.team.player1Name} / ${m.team.player2Name}` : m.team.player1Name,
          seed: m.seed,
          wins: m.wins,
          draws: m.draws,
          losses: m.losses,
          points: m.points,
          gameDiff: m.gameDiff,
          isAdvanced: m.isAdvanced,
        })),
      };
    });
  }

  async generateRoundRobinMatches(tournamentId: number, eventId: number) {
    const event = await this.verifyEvent(tournamentId, eventId);

    const groups = await this.prisma.groupStageGroup.findMany({
      where: { tournamentId, eventId },
      include: { memberships: true },
    });

    if (groups.length === 0) {
      throw new BadRequestException('No groups drawn. Draw groups first.');
    }

    // Check if matches have started
    const startedMatch = await this.prisma.match.findFirst({
      where: {
        tournamentId,
        eventId,
        status: { in: [MatchStatus.in_progress, MatchStatus.completed] },
      },
    });
    if (startedMatch) {
      throw new BadRequestException('Cannot regenerate matches: some matches have already started/completed.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete existing group matches
      await tx.match.deleteMany({
        where: { tournamentId, eventId, groupStage: true },
      });

      // Generate round robin matches for each group
      for (const group of groups) {
        const teamIds = group.memberships.map((m) => m.teamId);
        if (teamIds.length < 2) continue;

        const roundRobinList = [...teamIds];
        if (roundRobinList.length % 2 !== 0) {
          roundRobinList.push(-1); // dummy/bye team
        }

        const numTeams = roundRobinList.length;
        const rounds = numTeams - 1;
        const matchesPerRound = numTeams / 2;

        for (let round = 0; round < rounds; round++) {
          for (let m = 0; m < matchesPerRound; m++) {
            const homeIndex = (round + m) % (numTeams - 1);
            let awayIndex = (round - m + numTeams - 1) % (numTeams - 1);
            if (m === 0) {
              awayIndex = numTeams - 1;
            }

            const team1Id = roundRobinList[homeIndex];
            const team2Id = roundRobinList[awayIndex];

            // If neither is a dummy team, create match
            if (team1Id !== -1 && team2Id !== -1) {
              await tx.match.create({
                data: {
                  tournamentId,
                  eventId,
                  groupId: group.id,
                  groupStage: true,
                  round: `Round ${round + 1}`,
                  stage: 'Group Stage',
                  status: MatchStatus.scheduled,
                  team1Id,
                  team2Id,
                },
              });
            }
          }
        }
      }
    });

    return { success: true };
  }

  async getStandings(tournamentId: number, eventId: number) {
    return this.getGroups(tournamentId, eventId);
  }

  async advanceFromGroups(tournamentId: number, eventId: number) {
    const event = await this.verifyEvent(tournamentId, eventId);

    // Verify all group stage matches are completed
    const pendingMatch = await this.prisma.match.findFirst({
      where: {
        tournamentId,
        eventId,
        groupStage: true,
        status: { notIn: [MatchStatus.completed, MatchStatus.walkover] },
      },
    });

    if (pendingMatch) {
      throw new BadRequestException('Cannot advance: some group stage matches are not completed.');
    }

    const groups = await this.getGroups(tournamentId, eventId);
    if (groups.length === 0) {
      throw new BadRequestException('No groups found.');
    }

    const totalAdvance = event.totalAdvance ?? groups.length * 2;
    const numGroups = groups.length;
    const baseAdvancePerGroup = Math.floor(totalAdvance / numGroups);
    const extraSpots = totalAdvance % numGroups;

    const advancedMemberships: GroupStageMembershipResponseDto[] = [];
    const poolForExtra: GroupStageMembershipResponseDto[] = [];

    for (const group of groups) {
      group.memberships.forEach((m, idx) => {
        if (idx < baseAdvancePerGroup) {
          advancedMemberships.push(m);
        } else if (idx === baseAdvancePerGroup) {
          poolForExtra.push(m);
        }
      });
    }

    if (extraSpots > 0) {
      // Sort the poolForExtra candidates by points DESC -> gameDiff DESC -> original seed ASC
      poolForExtra.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
        return (a.seed ?? 999) - (b.seed ?? 999);
      });

      const chosenExtra = poolForExtra.slice(0, extraSpots);
      advancedMemberships.push(...chosenExtra);
    }

    // Now, update database with advanced status
    const advancedTeamIds = advancedMemberships.map((m) => m.teamId);

    await this.prisma.$transaction(async (tx) => {
      // Reset all memberships to isAdvanced = false
      await tx.groupStageMembership.updateMany({
        where: { group: { eventId } },
        data: { isAdvanced: false },
      });

      // Mark the selected ones as true
      await tx.groupStageMembership.updateMany({
        where: { teamId: { in: advancedTeamIds }, group: { eventId } },
        data: { isAdvanced: true },
      });

      // Seeds are regenerated for knockout
      // We clear existing seeds and replace them with new seeds based on the advanced teams
      // Ordered by points DESC -> gameDiff DESC -> original seed ASC
      const sortedAdvanced = [...advancedMemberships].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
        return (a.seed ?? 999) - (b.seed ?? 999);
      });

      await tx.seed.deleteMany({
        where: { tournamentId, eventId },
      });

      for (let i = 0; i < sortedAdvanced.length; i++) {
        const m = sortedAdvanced[i];
        await tx.seed.create({
          data: {
            tournamentId,
            eventId,
            seed: i + 1,
            teamId: m.teamId,
            teamName: m.teamName,
            rating: 0, // rating placeholder
            status: 'locked',
          },
        });
      }
    });

    // Fire-and-forget notification for advanced teams
    void this.handleAdvanceKnockoutNotification(tournamentId, eventId, advancedTeamIds);

    return { advancedTeamsCount: advancedTeamIds.length };
  }

  private async handleAdvanceKnockoutNotification(tournamentId: number, eventId: number, advancedTeamIds: number[]) {
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
        where: { id: { in: advancedTeamIds } }
      });

      const playerIds = new Set<string>();
      for (const team of teams) {
        if (team.player1Id) playerIds.add(team.player1Id);
        if (team.player2Id) playerIds.add(team.player2Id);
      }

      const actionUrl = `${this.notificationClient.frontendUrl}/tournaments/${tournamentId}`;

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
          'tournament_advance_knockout',
          {
            playerName: name,
            tournamentName: tournament.name,
            eventName: event.name,
            actionUrl,
          }
        );
      }

      // Send In-app Notifications
      if (playerIds.size > 0) {
        await this.notificationClient.sendInAppNotification(
          Array.from(playerIds),
          '🎉 Tiến cấp Knockout thành công!',
          `Chúc mừng! Bạn đã vượt qua vòng bảng và tiến cấp vào vòng Knockout nội dung ${event.name} tại giải đấu ${tournament.name}.`
        );
      }
    } catch (err) {
      this.logger.error(`Failed to handle advance knockout notification: ${err}`);
    }
  }

  /**
   * Recounts every membership's wins/draws/losses/points/gameDiff based on group matches.
   * Standard scoring: wins = 3 points, draws = 1 point, losses = 0 points.
   * gameDiff is computed by parsing the match score string, e.g. "11-8, 11-9" vs "8-11, 9-11".
   */
  async recomputeGroupStandings(tournamentId: number, eventId: number): Promise<void> {
    const memberships = await this.prisma.groupStageMembership.findMany({
      where: { group: { eventId } },
    });

    const statsMap = new Map<number, { wins: number; draws: number; losses: number; points: number; gameDiff: number }>();
    memberships.forEach((m) => {
      statsMap.set(m.teamId, { wins: 0, draws: 0, losses: 0, points: 0, gameDiff: 0 });
    });

    const matches = await this.prisma.match.findMany({
      where: { tournamentId, eventId, groupStage: true, winner: { not: null } },
    });

    for (const m of matches) {
      if (m.team1Id === null || m.team2Id === null || m.winner === null) continue;

      const team1Stats = statsMap.get(m.team1Id) ?? { wins: 0, draws: 0, losses: 0, points: 0, gameDiff: 0 };
      const team2Stats = statsMap.get(m.team2Id) ?? { wins: 0, draws: 0, losses: 0, points: 0, gameDiff: 0 };

      // Winner / Loser / Points
      const loserId = m.winner === m.team1Id ? m.team2Id : m.team1Id;
      const winnerStats = statsMap.get(m.winner) ?? { wins: 0, draws: 0, losses: 0, points: 0, gameDiff: 0 };
      const loserStats = statsMap.get(loserId) ?? { wins: 0, draws: 0, losses: 0, points: 0, gameDiff: 0 };

      if (m.status === MatchStatus.walkover) {
        winnerStats.wins += 1;
        winnerStats.points += 3;
        winnerStats.gameDiff += 2; // Walkover default gameDiff
        loserStats.losses += 1;
        loserStats.gameDiff -= 2;
      } else {
        winnerStats.wins += 1;
        winnerStats.points += 3;
        loserStats.losses += 1;

        // Parse score difference if available: e.g. "11-8, 11-9"
        if (m.score) {
          let t1Games = 0;
          let t2Games = 0;
          const sets = m.score.split(',');
          for (const set of sets) {
            const parts = set.trim().split('-');
            if (parts.length === 2) {
              const s1 = parseInt(parts[0], 10);
              const s2 = parseInt(parts[1], 10);
              if (!isNaN(s1) && !isNaN(s2)) {
                if (s1 > s2) t1Games++;
                else if (s2 > s1) t2Games++;
              }
            }
          }
          const diff = t1Games - t2Games;
          team1Stats.gameDiff += diff;
          team2Stats.gameDiff -= diff;
        }
      }
    }

    await this.prisma.$transaction(
      memberships.map((m) => {
        const stats = statsMap.get(m.teamId) ?? { wins: 0, draws: 0, losses: 0, points: 0, gameDiff: 0 };
        return this.prisma.groupStageMembership.update({
          where: { id: m.id },
          data: {
            wins: stats.wins,
            draws: stats.draws,
            losses: stats.losses,
            points: stats.points,
            gameDiff: stats.gameDiff,
          },
        });
      }),
    );
  }
}
