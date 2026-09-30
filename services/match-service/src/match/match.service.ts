import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { CreateMatchBatchDto } from './dto/create-match-batch.dto';
import { ConfirmResultDto } from './dto/confirm-result.dto';
import { OverrideResultDto } from './dto/override-result.dto';
import { MatchQueryDto } from './dto/match-query.dto';
import { QueryMatchesBySessionsInternalDto } from './dto/query-matches-by-sessions.dto';
import { Match, MatchStatus, MatchType, MatchCategory, Prisma, WinnerTeam } from '@prisma/client';
import axios from 'axios';
import { PickleballScoringEngine } from './pickleball-scoring.engine';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';


@Injectable()
export class MatchService {
  private readonly logger = new Logger(MatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('match-sync') private readonly matchSyncQueue: Queue,
  ) { }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private get userServiceUrl() {
    return process.env.USER_SERVICE_URL ?? 'http://localhost:8006';
  }

  private get userInternalToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  private get sportCenterServiceUrl() {
    return process.env.SPORT_CENTER_SERVICE_URL ?? 'http://localhost:8007';
  }

  private get sportCenterInternalToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  private async getCourtInfo(courtId: string) {
    if (!courtId) return null;
    try {
      const res = await axios.post(
        `${this.sportCenterServiceUrl}/api/sport-centers/internal/courts/batch`,
        { courtIds: [courtId] },
        { headers: { 'x-internal-service-token': this.sportCenterInternalToken }, validateStatus: () => true }
      );
      if ((res.status === 200 || res.status === 201) && Array.isArray(res.data) && res.data.length > 0) {
        return res.data[0];
      }
    } catch (e) {
      this.logger.error(`Failed to fetch court info: ${e}`);
    }
    return { id: courtId };
  }

  private async getCourtsInfo(courtIds: string[]) {
    const uniqueIds = Array.from(new Set(courtIds.filter(Boolean)));
    if (uniqueIds.length === 0) return new Map();
    try {
      const res = await axios.post(
        `${this.sportCenterServiceUrl}/api/sport-centers/internal/courts/batch`,
        { courtIds: uniqueIds },
        { headers: { 'x-internal-service-token': this.sportCenterInternalToken }, validateStatus: () => true }
      );
      if ((res.status === 200 || res.status === 201) && Array.isArray(res.data)) {
        return new Map(res.data.map((c: any) => [c.id, c]));
      }
    } catch (e) {
      this.logger.error(`Failed to fetch courts info: ${e}`);
    }
    return new Map();
  }

  private async getUsersProfiles(userIds: string[]) {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) return new Map();

    try {
      const res = await axios.post(
        `${this.userServiceUrl}/api/users/internal/batch`,
        { userIds: uniqueIds },
        { headers: { 'x-internal-service-token': this.userInternalToken }, validateStatus: () => true }
      );
      if (res.status === 201 || res.status === 200) {
        const users = Array.isArray(res.data) ? res.data : [];
        return new Map(users.map((u: any) => [u.id, u]));
      }
    } catch (e) {
      this.logger.error(`Failed to fetch user profiles: ${e}`);
    }
    return new Map();
  }

  private async populateMatchProfiles(match: Match) {
    const userIds = [...match.teamA, ...match.teamB];
    if (match.refereeId) userIds.push(match.refereeId);
    if (match.createdById) userIds.push(match.createdById);

    const [profilesMap, courtInfo, history] = await Promise.all([
      this.getUsersProfiles(userIds),
      this.getCourtInfo(match.courtId),
      this.prisma.matchScoreHistory.findMany({
        where: { matchId: match.id },
        orderBy: { timestamp: 'asc' },
      }),
    ]);

    const firstServingTeam = match.firstServingPlayerId && match.teamB.includes(match.firstServingPlayerId) ? 'TEAM_B' : 'TEAM_A';

    const livescore = PickleballScoringEngine.computeState(
      match.teamA,
      match.teamB,
      match.matchType,
      history,
      undefined,
      firstServingTeam
    );

    const resolvePlayer = (idOrName: string, defaultName: string) => {
      const p = profilesMap.get(idOrName);
      if (p) {
        return {
          id: idOrName,
          name: p.fullName || p.name || defaultName,
          avatarUrl: p.avatarUrl || p.avatar || null,
        };
      }
      return {
        id: idOrName,
        name: idOrName,
        avatarUrl: null,
      };
    };

    return {
      ...match,
      teamA: match.teamA.map(id => profilesMap.get(id) || { id }),
      teamB: match.teamB.map(id => profilesMap.get(id) || { id }),
      referee: match.refereeId ? (profilesMap.get(match.refereeId) || { id: match.refereeId }) : null,
      createdBy: match.createdById ? (profilesMap.get(match.createdById) || { id: match.createdById }) : null,
      court: courtInfo,
      livescore: {
        servingTeam: livescore.servingTeam,
        servingPlayerId: livescore.servingPlayerId,
        serverNumber: livescore.serverNumber,
        scoreCall: livescore.scoreCall,
        positions: {
          teamA: {
            right: resolvePlayer(livescore.positions.teamA.right, 'Player A1'),
            left: livescore.positions.teamA.left ? resolvePlayer(livescore.positions.teamA.left, 'Player A2') : null,
          },
          teamB: {
            right: resolvePlayer(livescore.positions.teamB.right, 'Player B1'),
            left: livescore.positions.teamB.left ? resolvePlayer(livescore.positions.teamB.left, 'Player B2') : null,
          },
        },
      },
    };
  }

  private async populateMatchesProfiles(matches: Match[]) {
    const userIds = new Set<string>();
    const courtIds = new Set<string>();
    for (const m of matches) {
      m.teamA.forEach(id => userIds.add(id));
      m.teamB.forEach(id => userIds.add(id));
      if (m.refereeId) userIds.add(m.refereeId);
      if (m.createdById) userIds.add(m.createdById);
      if (m.courtId) courtIds.add(m.courtId);
    }

    const [profilesMap, courtsMap] = await Promise.all([
      this.getUsersProfiles(Array.from(userIds)),
      this.getCourtsInfo(Array.from(courtIds)),
    ]);

    return matches.map(match => ({
      ...match,
      teamA: match.teamA.map(id => profilesMap.get(id) || { id }),
      teamB: match.teamB.map(id => profilesMap.get(id) || { id }),
      referee: match.refereeId ? (profilesMap.get(match.refereeId) || { id: match.refereeId }) : null,
      createdBy: match.createdById ? (profilesMap.get(match.createdById) || { id: match.createdById }) : null,
      court: courtsMap.get(match.courtId) || { id: match.courtId },
    }));
  }

  private async findMatchOrFail(matchId: string): Promise<Match> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found.');
    return match;
  }

  /** Returns which team the caller is a member of, or REFEREE, or null */
  private callerTeam(
    callerId: string,
    match: Match,
  ): 'A' | 'B' | 'REFEREE' | null {
    if (match.refereeId === callerId) return 'REFEREE';
    if (match.teamA.includes(callerId)) return 'A';
    if (match.teamB.includes(callerId)) return 'B';
    return null;
  }

  /** Derive winner from score when players self-confirm (no referee) */
  private deriveWinner(scoreA: number, scoreB: number): WinnerTeam {
    if (scoreA > scoreB) return WinnerTeam.TEAM_A;
    if (scoreB > scoreA) return WinnerTeam.TEAM_B;
    return WinnerTeam.DRAW;
  }

  // ─── Create ─────────────────────────────────────────────────────────────────

  async createMatch(callerId: string, dto: CreateMatchDto) {
    const { matchType = MatchType.PRACTICE, scheduledAt, courtId, teamA, teamB, category = MatchCategory.CUSTOM } = dto;

    const allPlayers = [...teamA, ...teamB];

    // A tournament or social session host can create matches for others.
    // We only enforce the caller to be a participant for standalone CUSTOM matches.
    if (category === MatchCategory.CUSTOM) {
      if (!allPlayers.includes(callerId) && dto.refereeId !== callerId) {
        throw new BadRequestException('For custom matches, the creator must include themselves in teamA or teamB, or act as the referee.');
      }
    }

    if (matchType === MatchType.SINGLES && (teamA.length !== 1 || teamB.length !== 1)) {
      throw new BadRequestException('SINGLES match requires exactly 1 player per team.');
    }

    if (matchType === MatchType.DOUBLES && (teamA.length !== 2 || teamB.length !== 2)) {
      throw new BadRequestException('DOUBLES match requires exactly 2 players per team.');
    }

    if (dto.refereeId && allPlayers.includes(dto.refereeId)) {
      throw new BadRequestException('The referee cannot be a player in the same match.');
    }

    const match = await this.prisma.match.create({
      data: {
        category,
        matchType,
        scheduledAt: new Date(scheduledAt),
        courtId,
        teamA,
        teamB,
        refereeId: dto.refereeId ?? null,
        tournamentId: dto.tournamentId ?? null,
        playSessionId: dto.playSessionId ?? null,
        createdById: callerId,
        bestOfSets: dto.bestOfSets ?? undefined,
        pointsToWin: dto.pointsToWin ?? undefined,
      },
    });

    this.logger.log(`Match created: id=${match.id} by userId=${callerId}`);
    return this.populateMatchProfiles(match);
  }

  // ─── Batch Create (internal) ────────────────────────────────────────────────

  async createMatchBatch(callerId: string, dto: CreateMatchBatchDto) {
    const { playSessionId, tournamentId, matches } = dto;

    if (!playSessionId && !tournamentId) {
      throw new BadRequestException('Either playSessionId or tournamentId is required.');
    }

    // Validate every item before touching the DB
    for (let i = 0; i < matches.length; i++) {
      const item = matches[i];
      const allPlayers = [...item.teamA, ...item.teamB];
      const matchType = item.matchType ?? MatchType.DOUBLES;

      if (matchType === MatchType.SINGLES && (item.teamA.length !== 1 || item.teamB.length !== 1)) {
        throw new BadRequestException(`Match[${i}]: SINGLES requires exactly 1 player per team.`);
      }
      if (matchType === MatchType.DOUBLES && (item.teamA.length !== 2 || item.teamB.length !== 2)) {
        throw new BadRequestException(`Match[${i}]: DOUBLES requires exactly 2 players per team.`);
      }
      if (item.refereeId && allPlayers.includes(item.refereeId)) {
        throw new BadRequestException(`Match[${i}]: referee cannot also be a player.`);
      }
    }

    const created = await this.prisma.$transaction(
      matches.map((item) =>
        this.prisma.match.create({
          data: {
            category: item.category ?? (tournamentId ? MatchCategory.TOURNAMENT : MatchCategory.SOCIAL),
            matchType: item.matchType ?? MatchType.DOUBLES,
            scheduledAt: new Date(item.scheduledAt),
            courtId: item.courtId,
            teamA: item.teamA,
            teamB: item.teamB,
            refereeId: item.refereeId ?? null,
            playSessionId: playSessionId ?? null,
            tournamentId: tournamentId ?? null,
            createdById: callerId,
            bestOfSets: item.bestOfSets ?? undefined,
            pointsToWin: item.pointsToWin ?? undefined,
          },
        }),
      ),
    );

    this.logger.log(
      `Batch created ${created.length} matches for ${tournamentId ? `tournamentId=${tournamentId}` : `playSessionId=${playSessionId}`} by userId=${callerId}`,
    );

    return {
      created: created.length,
      matches: await this.populateMatchesProfiles(created),
    };
  }

  // ─── Update ─────────────────────────────────────────────────────────────────

  async updateMatch(callerId: string, matchId: string, dto: UpdateMatchDto) {
    const match = await this.findMatchOrFail(matchId);

    if (match.status !== MatchStatus.SCHEDULED) {
      throw new BadRequestException('Only a SCHEDULED match can be updated.');
    }

    if (match.createdById !== callerId) {
      throw new ForbiddenException('Only the match creator can update it.');
    }

    const matchType = dto.matchType ?? match.matchType;
    const teamA = dto.teamA ?? match.teamA;
    const teamB = dto.teamB ?? match.teamB;

    if (teamA.length === 0 || teamB.length === 0) {
      throw new BadRequestException('Each team must have at least one player.');
    }

    if (matchType === MatchType.SINGLES && (teamA.length !== 1 || teamB.length !== 1)) {
      throw new BadRequestException('SINGLES match requires exactly 1 player per team.');
    }

    if (matchType === MatchType.DOUBLES && (teamA.length !== 2 || teamB.length !== 2)) {
      throw new BadRequestException('DOUBLES match requires exactly 2 players per team.');
    }

    const category = dto.category ?? match.category;
    const refereeId = dto.refereeId !== undefined ? dto.refereeId : match.refereeId;
    const allPlayers = [...teamA, ...teamB];

    if (category === MatchCategory.CUSTOM) {
      if (!allPlayers.includes(callerId) && refereeId !== callerId) {
        throw new BadRequestException('For custom matches, the creator must include themselves in teamA or teamB, or act as the referee.');
      }
    }

    if (refereeId && allPlayers.includes(refereeId)) {
      throw new BadRequestException('The referee cannot be a player in the same match.');
    }

    const updateData: Prisma.MatchUpdateInput = {};
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.matchType !== undefined) updateData.matchType = dto.matchType;
    if (dto.scheduledAt !== undefined) updateData.scheduledAt = new Date(dto.scheduledAt);
    if (dto.courtId !== undefined) updateData.courtId = dto.courtId;
    if (dto.teamA !== undefined) updateData.teamA = dto.teamA;
    if (dto.teamB !== undefined) updateData.teamB = dto.teamB;
    if (dto.refereeId !== undefined) updateData.refereeId = dto.refereeId;
    if (dto.tournamentId !== undefined) updateData.tournamentId = dto.tournamentId;
    if (dto.playSessionId !== undefined) updateData.playSessionId = dto.playSessionId;

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: updateData,
    });

    this.logger.log(`Match updated: id=${matchId} by userId=${callerId}`);
    return this.populateMatchProfiles(updated);
  }

  // ─── Get ────────────────────────────────────────────────────────────────────

  async listMatches(query: MatchQueryDto) {
    const {
      page = 1,
      limit = 10,
      userId,
      opponentId,
      matchType,
      category,
      status,
      tournamentId,
      courtId,
      playSessionId,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MatchWhereInput = {};

    if (matchType) where.matchType = matchType;
    if (category) where.category = category;
    if (status) where.status = status;
    if (tournamentId) where.tournamentId = tournamentId;
    if (courtId) where.courtId = courtId;
    if (playSessionId) where.playSessionId = playSessionId;

    // Fix #5: providing both userId and opponentId is ambiguous — reject early
    if (userId && opponentId) {
      throw new BadRequestException(
        'Provide either userId or opponentId, not both. To query head-to-head matches use the opponentId filter on GET /api/matches/my.',
      );
    }

    if (userId) {
      where.OR = [
        { teamA: { has: userId } },
        { teamB: { has: userId } },
        { refereeId: userId },
      ];
    } else if (opponentId) {
      where.OR = [
        { teamA: { has: opponentId } },
        { teamB: { has: opponentId } },
      ];
    }

    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) where.scheduledAt.gte = new Date(startDate);
      if (endDate) where.scheduledAt.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
      }),
      this.prisma.match.count({ where }),
    ]);

    return {
      items: await this.populateMatchesProfiles(items),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMatchStats(userId: string, query?: MatchQueryDto) {
    const {
      opponentId,
      matchType,
      category,
      tournamentId,
      courtId,
      playSessionId,
      startDate,
      endDate,
    } = query || {};

    const where: Prisma.MatchWhereInput = {
      status: MatchStatus.CONFIRMED,
      OR: [
        { teamA: { has: userId } },
        { teamB: { has: userId } },
      ],
    };

    if (matchType) where.matchType = matchType;
    if (category) where.category = category;
    if (tournamentId) where.tournamentId = tournamentId;
    if (courtId) where.courtId = courtId;
    if (playSessionId) where.playSessionId = playSessionId;

    if (opponentId) {
      where.AND = [
        {
          OR: [
            { teamA: { has: opponentId } },
            { teamB: { has: opponentId } },
          ],
        },
      ];
    }

    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) where.scheduledAt.gte = new Date(startDate);
      if (endDate) where.scheduledAt.lte = new Date(endDate);
    }

    const matches = await this.prisma.match.findMany({
      where,
      select: {
        teamA: true,
        teamB: true,
        winner: true,
      },
    });

    const totalMatches = matches.length;
    let wins = 0;
    let losses = 0;
    let draws = 0;

    for (const match of matches) {
      if (match.winner === WinnerTeam.DRAW) {
        draws++;
        continue;
      }

      const isTeamA = match.teamA.includes(userId);
      const isTeamB = match.teamB.includes(userId);

      if ((isTeamA && match.winner === WinnerTeam.TEAM_A) ||
        (isTeamB && match.winner === WinnerTeam.TEAM_B)) {
        wins++;
      } else if ((isTeamA && match.winner === WinnerTeam.TEAM_B) ||
        (isTeamB && match.winner === WinnerTeam.TEAM_A)) {
        losses++;
      }
    }

    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    return {
      totalMatches,
      wins,
      losses,
      draws,
      winRate,
    };
  }

  async getMatch(matchId: string) {
    const match = await this.findMatchOrFail(matchId);
    return this.populateMatchProfiles(match);
  }



  // ─── Start match ────────────────────────────────────────────────────────────

  async startMatch(callerId: string, matchId: string, firstServingPlayerId?: string) {
    const match = await this.findMatchOrFail(matchId);

    // Check match status
    if (match.status !== MatchStatus.SCHEDULED) {
      throw new BadRequestException('Only a SCHEDULED match can be started.');
    }

    // Check caller role
    const role = this.callerTeam(callerId, match);
    const isHost = match.category !== MatchCategory.CUSTOM && match.createdById === callerId;
    if (!role && !isHost) {
      throw new ForbiddenException('You are not a participant or host of this match.');
    }

    // Check first serving player
    if (firstServingPlayerId) {
      const allPlayers = [...match.teamA, ...match.teamB];
      if (!allPlayers.includes(firstServingPlayerId)) {
        throw new BadRequestException('firstServingPlayerId must belong to a player in this match.');
      }
    }

    // Update match status
    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.LIVE,
        startedAt: new Date(),
        firstServingPlayerId: firstServingPlayerId ?? null,
      },
    });

    if (match.tournamentId) {
      await this.syncMatchToTournament(match.tournamentId);
    }

    this.logger.log(`Match started: id=${matchId} by userId=${callerId}`);
    return this.populateMatchProfiles(updated);
  }



  // ─── Confirm result ──────────────────────────────────────────────────────────

  async confirmResult(
    callerId: string,
    matchId: string,
    dto: ConfirmResultDto,
  ) {
    const match = await this.findMatchOrFail(matchId);

    if (
      match.status !== MatchStatus.LIVE &&
      match.status !== MatchStatus.PENDING_CONFIRM
    ) {
      throw new BadRequestException(
        'Result can only be confirmed for a LIVE or PENDING_CONFIRM match.',
      );
    }

    // Check caller role
    const role = this.callerTeam(callerId, match);
    const isHost = match.category !== MatchCategory.CUSTOM && match.createdById === callerId;

    if (!role && !isHost) {
      throw new ForbiddenException('You are not a participant or host of this match.');
    }

    // Treat the host of non-CUSTOM matches exactly like an assigned referee
    const isActingAsReferee = role === 'REFEREE' || isHost;

    // Determine which confirmation flags will be set after this call
    const confirmedByA = role === 'A' ? true : match.confirmedByA;
    const confirmedByB = role === 'B' ? true : match.confirmedByB;
    const confirmedByRef = isActingAsReferee ? true : match.confirmedByRef;

    // Validate referee confirms with at least a score or explicit winner
    if (isActingAsReferee) {
      if (!dto.winner && (dto.scoreA === undefined || dto.scoreB === undefined)) {
        throw new BadRequestException('Referee or Host must specify the winner or provide the final score when confirming the result.');
      }
    }

    // Strict Score Validation (Option 1): If the match is already PENDING_CONFIRM,
    // the second team cannot overwrite the first team's score.
    if (match.status === MatchStatus.PENDING_CONFIRM && !isActingAsReferee) {
      const isSubmittingScores = dto.scoreA !== undefined || dto.scoreB !== undefined;
      if (isSubmittingScores) {
        const effectiveScoreA = dto.scoreA ?? match.scoreA;
        const effectiveScoreB = dto.scoreB ?? match.scoreB;
        if (effectiveScoreA !== match.scoreA || effectiveScoreB !== match.scoreB) {
          throw new BadRequestException(
            "The score you submitted does not match the opponent's score. Please submit the exact same score to agree, omit the score to accept their score, or initiate a dispute."
          );
        }
      }
    }

    // Fix #3: decide the final status before writing so a single DB update is used
    const isFullyConfirmed = isActingAsReferee || (match.refereeId ? confirmedByRef : (confirmedByA && confirmedByB));

    // Fix #2: when all parties confirm without a referee, require score so winner
    // derivation cannot silently produce DRAW from default 0-0 values
    if (isFullyConfirmed && !match.refereeId && !isHost && !dto.winner) {
      const effectiveScoreA = dto.scoreA ?? match.scoreA;
      const effectiveScoreB = dto.scoreB ?? match.scoreB;
      if (effectiveScoreA === 0 && effectiveScoreB === 0) {
        throw new BadRequestException(
          'Please provide scoreA and scoreB (or an explicit winner) when submitting the final confirmation.',
        );
      }
    }

    // Build update payload
    const updateData: Prisma.MatchUpdateInput = {
      confirmedByA,
      confirmedByB,
      confirmedByRef,
    };

    if (dto.scoreA !== undefined) updateData.scoreA = dto.scoreA;
    if (dto.scoreB !== undefined) updateData.scoreB = dto.scoreB;
    if (dto.sets !== undefined) updateData.sets = dto.sets as Prisma.InputJsonValue;

    if (isFullyConfirmed) {
      // Use effective scores (merge persisted + newly submitted) for derivation
      const effectiveScoreA = dto.scoreA ?? match.scoreA;
      const effectiveScoreB = dto.scoreB ?? match.scoreB;
      const winner = dto.winner ?? this.deriveWinner(effectiveScoreA, effectiveScoreB);

      updateData.status = MatchStatus.CONFIRMED;
      updateData.winner = winner;
      updateData.finishedAt = new Date();
      // Persist effective scores in case only one party provided them
      updateData.scoreA = effectiveScoreA;
      updateData.scoreB = effectiveScoreB;

      const confirmed = await this.prisma.match.update({
        where: { id: matchId },
        data: updateData,
      });

      if (match.tournamentId) {
        await this.syncMatchToTournament(match.tournamentId);
      }

      this.logger.log(`Match confirmed: id=${matchId} winner=${winner}`);
      return this.populateMatchProfiles(confirmed);
    }

    updateData.status = MatchStatus.PENDING_CONFIRM;
    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: updateData,
    });

    this.logger.log(`Partial confirmation: matchId=${matchId} role=${role} userId=${callerId}`);
    return this.populateMatchProfiles(updated);
  }

  async overrideMatchResult(matchId: string, dto: OverrideResultDto) {
    const match = await this.findMatchOrFail(matchId);

    const winner = dto.winner ?? WinnerTeam.TEAM_A;
    const scoreA = dto.scoreA ?? 0;
    const scoreB = dto.scoreB ?? 0;
    const sets = dto.sets ?? [[scoreA, scoreB]];

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.CONFIRMED,
        winner,
        scoreA,
        scoreB,
        sets,
        confirmedByA: true,
        confirmedByB: true,
        confirmedByRef: true,
        finishedAt: match.finishedAt ?? new Date(),
      },
    });

    if (match.tournamentId) {
      await this.syncMatchToTournament(match.tournamentId);
    }

    this.logger.log(`[Internal Override] Match result overridden: id=${matchId} status=CONFIRMED winner=${winner}`);
    return this.populateMatchProfiles(updated);
  }

  async unsyncMatchSchedule(matchId: string) {
    const match = await this.findMatchOrFail(matchId);
    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        scheduledAt: new Date('1970-01-01T00:00:00Z'),
        courtId: '00000000-0000-0000-0000-000000000000',
      },
    });
    this.logger.log(`[Internal Unsync] Match schedule unsynced: id=${matchId}`);
    return this.populateMatchProfiles(updated);
  }

  // ─── Cancel ─────────────────────────────────────────────────────────────────

  async cancelMatch(callerId: string, matchId: string) {
    const match = await this.findMatchOrFail(matchId);

    if (match.status === MatchStatus.CONFIRMED) {
      throw new BadRequestException('A confirmed match cannot be cancelled.');
    }

    // Fix #4: a match that has already started cannot be cancelled
    if (match.status === MatchStatus.LIVE) {
      throw new BadRequestException('A live match cannot be cancelled. Use the dispute flow instead.');
    }

    if (match.status === MatchStatus.PENDING_CONFIRM) {
      throw new BadRequestException('A match pending confirmation cannot be unilaterally cancelled. Please dispute the score instead.');
    }

    if (match.status === MatchStatus.CANCELLED) {
      throw new BadRequestException('Match is already cancelled.');
    }

    if (match.createdById !== callerId) {
      throw new ForbiddenException('Only the match creator can cancel it.');
    }

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.CANCELLED },
    });


    this.logger.log(`Match cancelled: id=${matchId} by userId=${callerId}`);
    return this.populateMatchProfiles(updated);
  }

  async queryPlayerMatches(userId: string, startDate?: string, endDate?: string) {
    const where: Prisma.MatchWhereInput = {
      OR: [
        { teamA: { has: userId } },
        { teamB: { has: userId } },
        { refereeId: userId },
      ],
    };

    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) where.scheduledAt.gte = new Date(startDate);
      if (endDate) where.scheduledAt.lte = new Date(endDate);
    }

    const matches = await this.prisma.match.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });

    return this.populateMatchesProfiles(matches);
  }

  async queryMatchesByPlaySessions(dto: QueryMatchesBySessionsInternalDto) {
    const { playSessionIds, status } = dto;
    const where: Prisma.MatchWhereInput = {
      playSessionId: {
        in: playSessionIds,
      },
    };

    if (status) {
      where.status = status;
    }

    const matches = await this.prisma.match.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
    });

    return this.populateMatchesProfiles(matches);
  }

  // ─── Score Point & Undo Point (Real-time Live Score) ─────────────────────────

  async getRawMatch(matchId: string) {
    return this.prisma.match.findUnique({ where: { id: matchId } });
  }

  private get tournamentServiceUrl() {
    return process.env.TOURNAMENT_SERVICE_URL ?? 'http://localhost:8008';
  }

  private get tournamentInternalToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? 'your-super-secret-internal-service-token-change-this-in-production';
  }

  async syncMatchToTournament(tournamentUuid: string) {
    if (!tournamentUuid) return;
    try {
      await this.matchSyncQueue.add(
        'sync-job',
        { tournamentUuid },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      this.logger.log(`Queued sync job for tournament: ${tournamentUuid}`);
    } catch (e) {
      this.logger.error(`Failed to queue match sync to tournament: ${e}`);
    }
  }

  private async recalculateMatchScore(
    matchId: string,
    matchType: MatchType,
    teamA: string[],
    teamB: string[],
    firstServingPlayerId?: string | null
  ) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { bestOfSets: true, pointsToWin: true, startedAt: true, finishedAt: true },
    });
    const bestOfSets = match?.bestOfSets ?? 3;
    const pointsToWin = match?.pointsToWin ?? 11;
    const dbStartedAt = match?.startedAt ?? null;
    const dbFinishedAt = match?.finishedAt ?? null;

    const history = await this.prisma.matchScoreHistory.findMany({
      where: { matchId },
      orderBy: { timestamp: 'asc' },
    });

    const ptsA = Array(bestOfSets).fill(0);
    const ptsB = Array(bestOfSets).fill(0);

    const firstServingTeam = firstServingPlayerId && teamB.includes(firstServingPlayerId) ? 'TEAM_B' : 'TEAM_A';

    // Tính điểm thực tế cho từng Set sử dụng PickleballScoringEngine
    for (let i = 1; i <= bestOfSets; i++) {
      const state = PickleballScoringEngine.computeState(teamA, teamB, matchType, history, i, firstServingTeam);
      ptsA[i - 1] = state.scoreA;
      ptsB[i - 1] = state.scoreB;
    }

    let setWinsA = 0;
    let setWinsB = 0;
    const setsArray: number[][] = [];
    const setsNeededToWin = Math.ceil(bestOfSets / 2);

    for (let i = 0; i < bestOfSets; i++) {
      const sa = ptsA[i];
      const sb = ptsB[i];

      const prevSetFinished = i > 0 && setsArray[i - 1] && (
        (setsArray[i - 1][0] >= pointsToWin || setsArray[i - 1][1] >= pointsToWin) &&
        Math.abs(setsArray[i - 1][0] - setsArray[i - 1][1]) >= 2
      );

      // Stop pushing sets if a team has already won the match, avoiding trailing [0,0] set
      if (setWinsA === setsNeededToWin || setWinsB === setsNeededToWin) {
        break;
      }

      if (sa > 0 || sb > 0 || i === 0 || prevSetFinished) {
        setsArray.push([sa, sb]);
      }

      if ((sa >= pointsToWin || sb >= pointsToWin) && Math.abs(sa - sb) >= 2) {
        if (sa > sb) {
          setWinsA++;
        } else {
          setWinsB++;
        }
      }
    }

    let winner: WinnerTeam | null = null;
    // Nếu trận đấu đã từng có giờ bắt đầu (dbStartedAt != null) hoặc đang có điểm, thì chắc chắn phải giữ trạng thái LIVE
    let newStatus: MatchStatus = (history.length > 0 || dbStartedAt != null) ? MatchStatus.LIVE : MatchStatus.SCHEDULED;
    let finishedAt: Date | null = null;

    if (setWinsA === setsNeededToWin) {
      winner = WinnerTeam.TEAM_A;
      newStatus = MatchStatus.PENDING_CONFIRM;
      finishedAt = dbFinishedAt ?? new Date();
    } else if (setWinsB === setsNeededToWin) {
      winner = WinnerTeam.TEAM_B;
      newStatus = MatchStatus.PENDING_CONFIRM;
      finishedAt = dbFinishedAt ?? new Date();
    }


    return {
      scoreA: setWinsA,
      scoreB: setWinsB,
      sets: setsArray,
      status: newStatus,
      winner,
      finishedAt,
    };
  }

  async scorePoint(matchId: string, setId: number, scoringTeam: 'TEAM_A' | 'TEAM_B') {
    const match = await this.findMatchOrFail(matchId);

    if (match.status === MatchStatus.CONFIRMED || match.status === MatchStatus.CANCELLED) {
      throw new BadRequestException('Cannot score points for a finished or cancelled match.');
    }

    if (!Number.isInteger(setId) || setId < 1 || setId > match.bestOfSets) {
      throw new BadRequestException(`Invalid Set ID: ${setId}. Set ID must be between 1 and ${match.bestOfSets}.`);
    }

    // 1. Log the point (lưu VĐV thắng loạt bóng)
    await this.prisma.matchScoreHistory.create({
      data: {
        matchId,
        setId,
        scoringTeam,
      },
    });

    // 2. Tính toán điểm số chính quy
    const scoreData = await this.recalculateMatchScore(matchId, match.matchType, match.teamA, match.teamB, match.firstServingPlayerId);


    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        scoreA: scoreData.scoreA,
        scoreB: scoreData.scoreB,
        sets: scoreData.sets as Prisma.InputJsonValue,
        status: scoreData.status,
        winner: scoreData.winner,
        startedAt: match.startedAt ?? new Date(),
        finishedAt: scoreData.finishedAt,
      },
    });

    this.logger.log(
      `Point scored for ${scoringTeam} in match ${matchId} (Set ${setId}). Recalculated sets: ${JSON.stringify(
        scoreData.sets
      )}`
    );

    return this.populateMatchProfiles(updated);
  }

  async undoPoint(matchId: string) {
    const match = await this.findMatchOrFail(matchId);

    if (match.status === MatchStatus.CONFIRMED || match.status === MatchStatus.CANCELLED) {
      throw new BadRequestException('Cannot undo points for a finished or cancelled match.');
    }

    const latestPoint = await this.prisma.matchScoreHistory.findFirst({
      where: { matchId },
      orderBy: { timestamp: 'desc' },
    });

    if (!latestPoint) {
      throw new BadRequestException('No points recorded for this match.');
    }

    // Xóa quả điểm gần nhất
    await this.prisma.matchScoreHistory.delete({
      where: { id: latestPoint.id },
    });

    // Tính toán lại toàn bộ điểm số
    const scoreData = await this.recalculateMatchScore(matchId, match.matchType, match.teamA, match.teamB, match.firstServingPlayerId);

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        scoreA: scoreData.scoreA,
        scoreB: scoreData.scoreB,
        sets: scoreData.sets as Prisma.InputJsonValue,
        status: scoreData.status,
        winner: scoreData.winner,
        finishedAt: scoreData.finishedAt,
      },
    });

    this.logger.log(
      `Undid last point in match ${matchId}. Recalculated sets: ${JSON.stringify(scoreData.sets)}`
    );

    if (match.tournamentId) {
      void this.syncMatchToTournament(match.tournamentId);
    }

    return this.populateMatchProfiles(updated);
  }
}
