/**
 * Shared mapping from a local `Match` row to the front-end `Match` contract
 * (see `docs/types.ts`). Keeps every match-returning endpoint emitting enriched
 * teams/court/event instead of bare ids, so the FE can render without extra lookups.
 */

export interface MatchTeamPlayerView {
  id: string | null;
  name: string | null;
  rating: number | null;
  gender: string | null;
  duprId: string | null;
}

export interface MatchTeamView {
  teamId: number;
  name: string;
  seed: number | null;
  rating: number | null;
  score?: number;
  player1: MatchTeamPlayerView;
  player2: MatchTeamPlayerView | null;
}

export interface MatchView {
  id: number;
  event: string | null;
  round: string | null;
  team1: MatchTeamView | null;
  team2: MatchTeamView | null;
  winner: number | null; // 1 = team1, 2 = team2 (FE contract)
  score: string | null;
  status: string;
  court: string | null; // court name (FE `Match.court`)
  courtId: string | null;
  courtStatus: string | null;
  externalMatchId: string | null;
  bookingId: number | null;
  bookingItemId: string | null;
  refereeId: string | null;
  refereeName: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
}

type TeamRow = {
  id: number;
  player1Id: string;
  player1Name: string;
  player1Rating: number;
  player1Gender: string | null;
  player1DuprId: string | null;
  player2Id: string | null;
  player2Name: string | null;
  player2Rating: number | null;
  player2Gender: string | null;
  player2DuprId: string | null;
  avgRating: number | null;
};
type CourtRow = { id?: string; name?: string; status?: string } | null | undefined;

/** "Alice / Bob" for a pair, or just "Alice" for a single. */
export function teamName(team: { player1Name: string; player2Name: string | null }): string {
  return team.player2Name ? `${team.player1Name} / ${team.player2Name}` : team.player1Name;
}

function parseScores(score: string | null): [number | null, number | null] {
  if (!score) return [null, null];
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(score);
  return m ? [Number(m[1]), Number(m[2])] : [null, null];
}

function teamView(team: TeamRow | null | undefined, seedByTeam: Map<number, number>, score: number | null): MatchTeamView | null {
  if (!team) return null;
  const view: MatchTeamView = {
    teamId: team.id,
    name: teamName(team),
    seed: seedByTeam.get(team.id) ?? null,
    rating: team.avgRating ?? null,
    player1: {
      id: team.player1Id,
      name: team.player1Name,
      rating: team.player1Rating,
      gender: team.player1Gender ?? null,
      duprId: team.player1DuprId ?? null,
    },
    player2: team.player2Id
      ? {
          id: team.player2Id,
          name: team.player2Name ?? null,
          rating: team.player2Rating ?? null,
          gender: team.player2Gender ?? null,
          duprId: team.player2DuprId ?? null,
        }
      : null,
  };
  if (score != null) view.score = score;
  return view;
}

export interface MatchLike {
  id: number;
  round?: string | null;
  team1Id: number | null;
  team2Id: number | null;
  team1?: TeamRow | null;
  team2?: TeamRow | null;
  winner: number | null;
  score: string | null;
  status: string;
  externalMatchId?: string | null;
  bookingId?: number | null;
  bookingItemId?: string | null;
  event?: { name: string } | null;
  refereeId?: string | null;
  refereeName?: string | null;
  time?: Date | null;
  duration?: number | null;
}

export function toMatchView(
  m: MatchLike,
  opts: {
    seedByTeam?: Map<number, number>;
    eventName?: string | null;
    court?: CourtRow;
    date?: string | null;
    startTime?: string | null;
    endTime?: string | null;
  } = {},
): MatchView {
  const seedByTeam = opts.seedByTeam ?? new Map<number, number>();
  const [s1, s2] = parseScores(m.score ?? null);
  return {
    id: m.id,
    event: opts.eventName ?? m.event?.name ?? null,
    round: m.round ?? null,
    team1: teamView(m.team1, seedByTeam, s1),
    team2: teamView(m.team2, seedByTeam, s2),
    winner: m.winner == null ? null : m.winner === m.team1Id ? 1 : m.winner === m.team2Id ? 2 : null,
    score: m.score ?? null,
    status: m.status,
    court: opts.court?.name ?? null,
    courtId: opts.court?.id ?? null,
    courtStatus: opts.court?.status ?? null,
    externalMatchId: m.externalMatchId ?? null,
    bookingId: m.bookingId ?? null,
    bookingItemId: m.bookingItemId ?? null,
    refereeId: m.refereeId ?? null,
    refereeName: m.refereeName ?? null,
    date: opts.date ?? null,
    startTime: opts.startTime ?? null,
    endTime: opts.endTime ?? null,
  };
}
