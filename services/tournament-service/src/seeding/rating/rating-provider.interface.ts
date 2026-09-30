import { Team } from '@prisma/client';

/** DI token for the active rating provider. */
export const RATING_PROVIDER = Symbol('RATING_PROVIDER');

/**
 * Source of a competitor's seeding rating. A team is treated as one opaque unit
 * (singles = team-of-one, doubles = two players), so the provider only needs the
 * team. Pluggable: `ManualRatingProvider` now (ratings captured at registration),
 * swappable for a `DuprApiProvider` later with no call-site changes.
 */
export interface RatingProvider {
  getTeamRating(team: Team): number;
}
