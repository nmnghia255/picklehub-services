import { BadRequestException, Injectable } from '@nestjs/common';

export type MatchmakingPlayerInput = {
  userId: string;
  skillLevel: number;
  guestsCount: number;
  joinedAt: Date;
  matchesPlayed: number;
};

type ExpandedPlayerSlot = {
  slotId: string;
  ownerUserId: string;
  skillLevel: number;
  joinedAt: Date;
  isGuest: boolean;
  matchesPlayed: number;
};

export type GeneratedMatchTeamSlot = {
  ownerUserId: string;
  slotId: string;
  isGuest: boolean;
};

export type MatchFormat = 'SINGLES' | 'DOUBLES';

export type GeneratedMatch = {
  matchIndex: number;   // 0-based index used by buildPairing to assign courts
  matchType: MatchFormat;
  teamA: GeneratedMatchTeamSlot[];
  teamB: GeneratedMatchTeamSlot[];
  isUnrated: boolean;
};

export type MatchmakingResult = {
  matches: GeneratedMatch[];
  waitingUserIds: string[];
};

@Injectable()
export class MatchmakingService {
  /**
   * Generate matches for a single round.
   */
  generateRoundMatches(
    players: MatchmakingPlayerInput[],
    singlesCount: number,
    doublesCount: number,
  ): MatchmakingResult {
    const singlesPlayersNeeded = singlesCount * 2;
    const doublesPlayersNeeded = doublesCount * 4;
    const totalPlayersNeeded = singlesPlayersNeeded + doublesPlayersNeeded;

    if (totalPlayersNeeded === 0) {
      return { matches: [], waitingUserIds: players.map(p => p.userId) };
    }

    const expandedPlayers = this.expandPlayers(players);

    // Sort: matchesPlayed ASC -> skillLevel DESC -> joinedAt ASC
    const sortedPlayers = expandedPlayers.sort((a, b) => {
      if (a.matchesPlayed !== b.matchesPlayed) return a.matchesPlayed - b.matchesPlayed;
      if (b.skillLevel !== a.skillLevel) return b.skillLevel - a.skillLevel;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    const playableSlots = sortedPlayers.slice(0, totalPlayersNeeded);
    const waitingSlots = sortedPlayers.slice(totalPlayersNeeded);

    const matches: GeneratedMatch[] = [];
    let currentIndex = 0;

    // Generate SINGLES
    const singlesGroup = playableSlots.slice(0, singlesPlayersNeeded);
    for (let i = 0; i < singlesCount; i++) {
      const p1 = singlesGroup[i * 2];
      const p2 = singlesGroup[i * 2 + 1];
      if (!p1 || !p2) break;
      matches.push({
        matchIndex: currentIndex++,
        matchType: 'SINGLES',
        teamA: [{ ownerUserId: p1.ownerUserId, slotId: p1.slotId, isGuest: p1.isGuest }],
        teamB: [{ ownerUserId: p2.ownerUserId, slotId: p2.slotId, isGuest: p2.isGuest }],
        isUnrated: p1.isGuest || p2.isGuest,
      });
    }

    // Generate DOUBLES
    const doublesGroup = playableSlots.slice(singlesPlayersNeeded, totalPlayersNeeded);
    for (let i = 0; i < doublesCount; i++) {
      const base = i * 4;
      const p1 = doublesGroup[base];
      const p2 = doublesGroup[base + 1];
      const p3 = doublesGroup[base + 2];
      const p4 = doublesGroup[base + 3];
      if (!p1 || !p2 || !p3 || !p4) break;
      
      // Serpentine balance: rank1+rank4 vs rank2+rank3
      matches.push({
        matchIndex: currentIndex++,
        matchType: 'DOUBLES',
        teamA: [
          { ownerUserId: p1.ownerUserId, slotId: p1.slotId, isGuest: p1.isGuest },
          { ownerUserId: p4.ownerUserId, slotId: p4.slotId, isGuest: p4.isGuest }
        ],
        teamB: [
          { ownerUserId: p2.ownerUserId, slotId: p2.slotId, isGuest: p2.isGuest },
          { ownerUserId: p3.ownerUserId, slotId: p3.slotId, isGuest: p3.isGuest }
        ],
        isUnrated: [p1, p2, p3, p4].some((s) => s.isGuest),
      });
    }

    const waitingUserIds = Array.from(
      new Set(waitingSlots.map((s) => s.ownerUserId)),
    );

    return { matches, waitingUserIds };
  }

  private expandPlayers(players: MatchmakingPlayerInput[]): ExpandedPlayerSlot[] {
    const expanded: ExpandedPlayerSlot[] = [];

    for (const player of players) {
      expanded.push({
        slotId: `${player.userId}:self`,
        ownerUserId: player.userId,
        skillLevel: player.skillLevel,
        joinedAt: player.joinedAt,
        isGuest: false,
        matchesPlayed: player.matchesPlayed,
      });

      for (let g = 0; g < player.guestsCount; g++) {
        expanded.push({
          slotId: `${player.userId}:guest:${g + 1}`,
          ownerUserId: player.userId,
          skillLevel: player.skillLevel,
          joinedAt: player.joinedAt,
          isGuest: true,
          matchesPlayed: player.matchesPlayed,
        });
      }
    }

    return expanded;
  }
}