import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { BookingModule } from '../booking/booking.module';
import { NotificationModule } from '../notification/notification.module';
import { CourtController } from './court.controller';
import { CourtService } from './court.service';
import { CourtInternalController } from './court-internal.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, BookingModule, NotificationModule, ConfigModule],
  controllers: [CourtController, CourtInternalController],
  providers: [CourtService],
  exports: [CourtService],
})
export class CourtModule {}
