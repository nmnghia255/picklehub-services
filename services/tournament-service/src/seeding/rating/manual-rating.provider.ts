import { Injectable } from '@nestjs/common';
import { Team } from '@prisma/client';
import { RatingProvider } from './rating-provider.interface';

/**
 * Uses the rating already captured on the team at registration/pairing time
 * (`avgRating`, falling back to player1's rating). No external calls — a future
 * `DuprApiProvider` can replace this behind the same `RATING_PROVIDER` token.
 */
@Injectable()
export class ManualRatingProvider implements RatingProvider {
  getTeamRating(team: Team): number {
    return team.avgRating ?? team.player1Rating ?? 0;
  }
}
