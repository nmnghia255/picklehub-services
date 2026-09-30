import { Module } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { TournamentsController } from './tournaments.controller';
import { InternalController } from './internal.controller';
import { RunModule } from '../run/run.module';
import { PosterService } from './poster/poster.service';

@Module({
  imports: [RunModule],
  controllers: [TournamentsController, InternalController],
  providers: [TournamentsService, PosterService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
