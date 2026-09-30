import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { FixturesController } from './fixtures.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BookingsController, FixturesController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
