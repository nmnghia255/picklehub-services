import { Module } from '@nestjs/common';
import { AuthIntegrationModule } from '../auth-integration/auth-integration.module';
import { PrismaService } from '../prisma.service';
import { CoachScheduleController } from './coach-schedule.controller';
import { CoachScheduleInternalController } from './coach-schedule.internal.controller';
import { CoachScheduleService } from './coach-schedule.service';

@Module({
  imports: [AuthIntegrationModule],
  controllers: [CoachScheduleController, CoachScheduleInternalController],
  providers: [CoachScheduleService, PrismaService],
})
export class CoachScheduleModule {}