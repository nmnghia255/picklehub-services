import { Module } from '@nestjs/common';
import { LearnerBookingController, CoachBookingController } from './private-booking.controller';
import { PrivateBookingService } from './private-booking.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [LearnerBookingController, CoachBookingController],
  providers: [PrivateBookingService, PrismaService],
})
export class PrivateBookingModule {}
