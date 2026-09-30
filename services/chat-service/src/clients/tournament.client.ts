import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';

export type TournamentAccess = {
  canAccess: boolean;
  role: 'ORGANIZER' | 'PLAYER' | 'REFEREE' | 'ADMIN';
  tournament: {
    id: string;
    name: string;
    status: string;
    organizerId?: string | null;
    registered?: number;
    capacity?: number;
  };
};

@Injectable()
export class TournamentClient {
  private readonly internalServiceHeader = 'x-internal-service-token';

  private get tournamentServiceUrl() {
    return process.env.TOURNAMENT_SERVICE_URL ?? 'http://localhost:8008';
  }

  private get internalToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  async assertTournamentAccess(
    tournamentId: string,
    userId: string,
  ): Promise<TournamentAccess> {
    const response = await axios.get(
      `${this.tournamentServiceUrl}/internal/tournaments/${tournamentId}/access/${userId}`,
      {
        headers: { [this.internalServiceHeader]: this.internalToken },
        validateStatus: () => true,
      },
    );

    if (response.status === 404) throw new NotFoundException('Tournament not found');
    if (response.status >= 400 || response.data?.canAccess !== true) {
      throw new ForbiddenException('You cannot access this tournament conversation');
    }

    return response.data as TournamentAccess;
  }
}
