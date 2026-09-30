import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  PlaySessionParticipantStatus,
} from "@prisma/client";
import { MatchCategory, MatchType } from "./match-enums";
import axios, { AxiosInstance } from "axios";
import { PrismaService } from "../../../prisma.service";
import {
  MatchFormat,
  MatchmakingPlayerInput,
  MatchmakingService,
} from "../../matchmaking.service";
import { SuggestBatchDto } from "./dto/suggest-batch.dto";
import { CommitBatchDto } from "./dto/commit-batch.dto";

// ─── External type shapes ────────────────────────────────────────────────────

type BookingItemInfo = {
  id: string;
  courtId: string;
  startTime: string;
  endTime: string;
  court: { id: string; name: string };
};

type BookingInfo = {
  id: string;
  date: string;
  status: string;
  totalPrice?: number | string | null;
  center: { id: string; name: string; address?: string };
  bookingItems: BookingItemInfo[];
};

type EligibleCourt = {
  courtNumber: number;
  courtId: string;
  courtName: string;
  bookingId: string;
};

type UserProfile = {
  id: string;
  selfRating?: number | null;
  [key: string]: unknown;
};

type SuggestedMatch = {
  courtNumber: number;
  courtId: string;
  courtName: string;
  bookingId: string;
  scheduledAt: Date;
  matchType: string;
  teamA: { participantId: string | null; userId: string; user?: any }[];
  teamB: { participantId: string | null; userId: string; user?: any }[];
  isUnrated: boolean;
};

type WaitingParticipant = {
  participantId: string;
  userId: string;
  user?: any;
};

type RoundResult = {
  roundIndex: number;
  scheduledAt: Date;
  availableCourts: EligibleCourt[];
  matches: SuggestedMatch[];
  waitingParticipants: WaitingParticipant[];
};

type PairingResult = {
  sessionStartTime: Date;
  rounds: RoundResult[];
};

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class MatchBatchService {
  private readonly logger = new Logger(MatchBatchService.name);
  private readonly centerAxios: AxiosInstance;
  private readonly userAxios: AxiosInstance;
  private readonly matchAxios: AxiosInstance;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly matchmaking: MatchmakingService
  ) {
    this.centerAxios = axios.create({
      baseURL: this.configService.get<string>("SPORT_CENTER_SERVICE_URL"),
      headers: {
        "X-Internal-Service-Token": this.configService.get<string>(
          "SERVICE_INTERNAL_TOKEN"
        ),
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    this.userAxios = axios.create({
      baseURL: this.configService.get<string>("USER_SERVICE_URL"),
      headers: {
        "x-internal-service-token": this.configService.get<string>("SERVICE_INTERNAL_TOKEN"),
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    this.matchAxios = axios.create({
      baseURL: this.configService.get<string>("MATCH_SERVICE_URL"),
      headers: {
        "x-internal-service-token": this.configService.get<string>(
          "SERVICE_INTERNAL_TOKEN"
        ),
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });
  }

  // #region Public: suggest

  async suggest(
    socialId: string,
    sessionId: string,
    callerId: string,
    dto: SuggestBatchDto
  ) {
    await this.requireCreator(socialId, callerId);

    const { sessionStartTime, rounds } =
      await this.buildPairing(sessionId, dto);

    this.logger.log(
      `Suggested matches for play session ${sessionId} across ${rounds.length} rounds`
    );

    return {
      message: "Match batch suggested",
      data: {
        sessionStartTime,
        rounds,
      },
    };
  }

  // #endregion

  // #region Public: commit

  async commit(
    socialId: string,
    sessionId: string,
    callerId: string,
    dto: CommitBatchDto
  ) {
    await this.requireCreator(socialId, callerId);

    const session = await this.prisma.playSession.findFirst({
      where: { id: sessionId, socialId },
      select: { id: true },
    });
    if (!session) {
      throw new NotFoundException("Play session not found");
    }

    // Forward the host's final (possibly edited) matches to match-service
    let batchResult: { created: number; matches: unknown[] };
    try {
      const response = await this.matchAxios.post("/api/matches/internal/batch", {
        playSessionId: sessionId,
        createdById: callerId,
        matches: dto.matches.map((m) => ({
          courtId: m.courtId,
          scheduledAt: m.scheduledAt,
          matchType: m.matchType ?? MatchType.DOUBLES,
          category: m.category ?? MatchCategory.SOCIAL,
          teamA: m.teamA,
          teamB: m.teamB,
          refereeId: m.refereeId,
        })),
      });
      batchResult = response.data;
    } catch (error) {
      const msg =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : error instanceof Error
            ? error.message
            : String(error);
      this.logger.error(`match-service batch failed: ${msg}`);
      throw new BadRequestException(`Failed to create matches: ${msg}`);
    }

    this.logger.log(
      `Committed ${batchResult.created} matches for play session ${sessionId} by userId=${callerId}`
    );

    return {
      message: "Match batch committed",
      data: {
        created: batchResult.created,
        matches: batchResult.matches,
      },
    };
  }

  // #endregion

  // #region Private: shared pairing logic

  /**
   * Core pairing algorithm used by `suggest`.
   *
   * 1. Validates session is IN_PROGRESS and reads its `startTime` from DB.
   * 2. Loads courts from sport-center-service that cover the session startTime,
   *    capped to `dto.courtCount`.
   * 3. Fetches CONFIRMED real-user PSPs, applies optional `excludeParticipantIds`.
   * 4. Enriches players with real `selfRating` from user-service (null → 0 fallback).
   * 5. Runs MatchmakingService with `dto.matchCount` and `dto.matchType`.
   * 6. Assigns courts round-robin if matchCount > courtCount.
   */
  private async buildPairing(
    sessionId: string,
    dto: SuggestBatchDto
  ): Promise<PairingResult> {
    const session = await this.prisma.playSession.findFirst({
      where: { id: sessionId },
      select: { id: true, bookingIds: true, startTime: true },
    });
    if (!session) {
      throw new NotFoundException("Play session not found");
    }

    // ── Courts ────────────────────────────────────────────────────────────────
    const sessionStartTime = session.startTime;
    const sessionCourts = await this.loadSessionCourts(session.bookingIds);
    if (sessionCourts.length === 0) {
      throw new BadRequestException("No booked courts found for this session.");
    }

    const maxEndMs = Math.max(...sessionCourts.map(c => c.endMs));
    const sessionStartTimeMs = sessionStartTime.getTime();
    
    const roundDurationMins = dto.roundDurationMins ?? 30;
    const totalDurationMins = Math.floor((maxEndMs - sessionStartTimeMs) / (60 * 1000));
    const totalRounds = Math.max(1, Math.floor(totalDurationMins / roundDurationMins));

    // ── Players ───────────────────────────────────────────────────────────────
    const excludeSet = new Set(dto.excludeParticipantIds ?? []);
    const psps = await this.prisma.playSessionParticipant.findMany({
      where: {
        playSessionId: sessionId,
        status: PlaySessionParticipantStatus.CONFIRMED,
        userId: { not: null },
      },
      orderBy: { joinedAt: "asc" },
      select: { id: true, userId: true, joinedAt: true },
    });

    const eligiblePsps = psps.filter(
      (psp) => psp.userId !== null && !excludeSet.has(psp.id)
    );

    const singlesCount = dto.singlesCount ?? 0;
    const doublesCount = dto.doublesCount ?? 0;
    const minPlayers = (singlesCount * 2) + (doublesCount * 4);

    if (eligiblePsps.length < minPlayers && minPlayers > 0) {
      throw new BadRequestException(
        `Need at least ${minPlayers} eligible participants for the requested match counts (got ${eligiblePsps.length}).`
      );
    }

    // ── Skill enrichment & State Tracking ─────────────────────────────────────
    const userIds = eligiblePsps.map((p) => p.userId as string);
    const profileMap = await this.loadUserProfiles(userIds);

    const userIdToPspId = new Map<string, string>();
    const matchesPlayedTracker = new Map<string, number>();
    for (const psp of eligiblePsps) {
      const uId = psp.userId as string;
      userIdToPspId.set(uId, psp.id);
      matchesPlayedTracker.set(uId, 0);
    }

    // ── Matchmaking per round ─────────────────────────────────────────────────
    const rounds: RoundResult[] = [];

    for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
      const roundStartTimeMs = sessionStartTimeMs + (roundIndex * roundDurationMins * 60 * 1000);
      const roundScheduledAt = new Date(roundStartTimeMs);

      const activeCourtsForRound = sessionCourts
        .filter(c => c.startMs <= roundStartTimeMs && roundStartTimeMs < c.endMs)
        .sort((a, b) => a.courtName.localeCompare(b.courtName))
        .map((slot, index) => ({
          courtNumber: index + 1,
          courtId: slot.courtId,
          courtName: slot.courtName,
          bookingId: slot.bookingId,
        }));

      const requestedMatchesCount = singlesCount + doublesCount;
      if (requestedMatchesCount > activeCourtsForRound.length) {
        throw new BadRequestException(
          `Not enough active courts in round ${roundIndex + 1} to schedule ${requestedMatchesCount} matches. Only ${activeCourtsForRound.length} courts are available.`
        );
      }

      if (requestedMatchesCount === 0 || activeCourtsForRound.length === 0) {
        rounds.push({ roundIndex, scheduledAt: roundScheduledAt, availableCourts: activeCourtsForRound, matches: [], waitingParticipants: [] });
        continue;
      }

      const matchmakingPlayers: MatchmakingPlayerInput[] = eligiblePsps.map((psp) => {
        const userId = psp.userId as string;
        return {
          userId,
          skillLevel: profileMap.get(userId)?.selfRating ?? 0,
          guestsCount: 0,
          joinedAt: psp.joinedAt,
          matchesPlayed: matchesPlayedTracker.get(userId) ?? 0,
        };
      });

      const result = this.matchmaking.generateRoundMatches(
        matchmakingPlayers,
        singlesCount,
        doublesCount
      );

      const matches: SuggestedMatch[] = result.matches.map((match) => {
        const court = activeCourtsForRound[match.matchIndex % activeCourtsForRound.length];
        
        [...match.teamA, ...match.teamB].forEach(slot => {
          const current = matchesPlayedTracker.get(slot.ownerUserId) ?? 0;
          matchesPlayedTracker.set(slot.ownerUserId, current + 1);
        });

        return {
          courtNumber: court.courtNumber,
          courtId: court.courtId,
          courtName: court.courtName,
          bookingId: court.bookingId,
          scheduledAt: roundScheduledAt,
          matchType: match.matchType,
          teamA: match.teamA.map((slot) => {
            const profile = profileMap.get(slot.ownerUserId);
            return {
              participantId: userIdToPspId.get(slot.ownerUserId) ?? null,
              userId: slot.ownerUserId,
              user: profile ? {
                id: profile.id,
                fullName: profile.fullName,
                avatarUrl: profile.avatarUrl,
                gender: profile.gender,
                selfRating: profile.selfRating,
              } : undefined,
            };
          }),
          teamB: match.teamB.map((slot) => {
            const profile = profileMap.get(slot.ownerUserId);
            return {
              participantId: userIdToPspId.get(slot.ownerUserId) ?? null,
              userId: slot.ownerUserId,
              user: profile ? {
                id: profile.id,
                fullName: profile.fullName,
                avatarUrl: profile.avatarUrl,
                gender: profile.gender,
                selfRating: profile.selfRating,
              } : undefined,
            };
          }),
          isUnrated: match.isUnrated,
        };
      });

      const waitingParticipants: WaitingParticipant[] = [];
      for (const userId of result.waitingUserIds) {
        const participantId = userIdToPspId.get(userId);
        if (!participantId) continue;
        const profile = profileMap.get(userId);
        waitingParticipants.push({
          participantId,
          userId,
          user: profile ? {
            id: profile.id,
            fullName: profile.fullName,
            avatarUrl: profile.avatarUrl,
            gender: profile.gender,
            selfRating: profile.selfRating,
          } : undefined,
        });
      }

      rounds.push({
        roundIndex,
        scheduledAt: roundScheduledAt,
        availableCourts: activeCourtsForRound,
        matches,
        waitingParticipants,
      });
    }

    return { sessionStartTime, rounds };
  }

  // #endregion

  // #region Private helpers

  private async requireCreator(socialId: string, callerId: string): Promise<void> {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: { creatorId: true },
    });
    if (!social) {
      throw new NotFoundException("Social not found");
    }
    if (social.creatorId !== callerId) {
      throw new ForbiddenException("Only the creator of this social can perform this action");
    }
  }

  /**
   * Fetches UserProfile for a list of userIds from user-service /internal/batch.
   * Returns a Map<userId, UserProfile>.
   * - user-service unreachable → logs warning, returns empty map
   */
  private async loadUserProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
    const profileMap = new Map<string, UserProfile>();
    if (userIds.length === 0) return profileMap;

    try {
      const response = await this.userAxios.post<UserProfile[]>("/api/users/internal/batch", {
        userIds,
      });
      const profiles = Array.isArray(response.data) ? response.data : [];
      for (const profile of profiles) {
        if (profile?.id) {
          profileMap.set(profile.id, profile);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Could not load user profiles from user-service: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return profileMap;
  }

  /**
   * Fetches all booked courts from sport-center-service for the given bookings.
   */
  private async loadSessionCourts(
    bookingIds: string[]
  ): Promise<Array<{ courtId: string; courtName: string; bookingId: string; startMs: number; endMs: number }>> {
    if (bookingIds.length === 0) return [];

    let bookingInfos: BookingInfo[] = [];
    try {
      const response = await this.centerAxios.post("/api/bookings/batch", { bookingIds });
      bookingInfos = response.data?.bookingInfos ?? [];
    } catch (error) {
      this.logger.warn(
        `Failed to fetch booking infos from sport-center-service: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw new BadRequestException("Failed to fetch booking infos from sport-center-service.");
    }

    const allCourts: Array<{ bookingId: string; courtId: string; courtName: string; startMs: number; endMs: number }> = [];
    for (const info of bookingInfos) {
      for (const item of info.bookingItems ?? []) {
        const start = composeBookingDate(info.date, item.startTime);
        const end = composeBookingDate(info.date, item.endTime);
        if (start === null || end === null) continue;
        allCourts.push({
          bookingId: info.id,
          courtId: item.court.id,
          courtName: item.court.name,
          startMs: start,
          endMs: end,
        });
      }
    }

    return allCourts;
  }

  // #endregion
}

/**
 * Combine a booking's `date` (YYYY-MM-DD) with its `HH:MM` time string into
 * a UTC epoch ms. Returns null on malformed input — caller silently skips.
 */
function composeBookingDate(
  date: string | undefined,
  time: string | undefined
): number | null {
  if (!date || !time) return null;
  const isoDate = date.length >= 10 ? date.slice(0, 10) : null;
  if (!isoDate) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const composed = new Date(
    `${isoDate}T${match[1].padStart(2, "0")}:${match[2]}:00.000Z`
  );
  const ms = composed.getTime();
  return Number.isNaN(ms) ? null : ms;
}
