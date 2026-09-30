import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SeedingController } from './seeding.controller';
import { SeedingService } from './seeding.service';
import { RATING_PROVIDER } from './rating/rating-provider.interface';
import { ManualRatingProvider } from './rating/manual-rating.provider';

@Module({
  imports: [PrismaModule],
  controllers: [SeedingController],
  providers: [
    SeedingService,
    { provide: RATING_PROVIDER, useClass: ManualRatingProvider },
  ],
  exports: [SeedingService],
})
export class SeedingModule {}
