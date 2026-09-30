import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { CourtBookingController } from './court-booking.controller';
import { CourtBookingService } from './court-booking.service';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'activity-reminder-queue',
    }),
  ],
  controllers: [CourtBookingController],
  providers: [CourtBookingService, PrismaService],
})
export class CourtBookingModule { }
