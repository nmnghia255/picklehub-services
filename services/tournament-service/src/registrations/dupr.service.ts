import { Injectable } from '@nestjs/common';

@Injectable()
export class DuprService {
  async verifyOrFetchRating(duprId: string, fallbackRating: number): Promise<number> {
    // Currently no real DUPR API integration: return the fallbackRating (self-filled rating)
    // In future, fetch from DUPR API using duprId and return true rating.
    return fallbackRating;
  }
}
