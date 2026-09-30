import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import axios from 'axios';

@Processor('match-sync')
export class MatchSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchSyncProcessor.name);

  private get tournamentServiceUrl() {
    return process.env.TOURNAMENT_SERVICE_URL ?? 'http://localhost:8008';
  }

  private get tournamentInternalToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? 'your-super-secret-internal-service-token-change-this-in-production';
  }

  async process(job: Job<{ tournamentUuid: string }, any, string>): Promise<any> {
    const { tournamentUuid } = job.data;
    this.logger.log(`Processing match sync for tournament: ${tournamentUuid}`);

    try {
      const res = await axios.post(
        `${this.tournamentServiceUrl}/api/tournaments/internal/fixtures/sync-by-uuid`,
        { tournamentUuid },
        {
          headers: { 'x-internal-service-token': this.tournamentInternalToken },
          validateStatus: () => true,
        }
      );
      this.logger.log(`Successfully synced match results to tournament ${tournamentUuid} (Status: ${res.status})`);
    } catch (error) {
      this.logger.error(`Failed to sync match results to tournament ${tournamentUuid}:`, error);
      throw error; // Let BullMQ handle retries
    }
  }
}
