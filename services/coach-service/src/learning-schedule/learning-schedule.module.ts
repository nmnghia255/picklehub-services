import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LearningScheduleController } from './learning-schedule.controller';
import { LearningScheduleInternalController } from './learning-schedule.internal.controller';
import { LearningScheduleService } from './learning-schedule.service';

@Module({
  controllers: [LearningScheduleController, LearningScheduleInternalController],
  providers: [LearningScheduleService, PrismaService],
})
export class LearningScheduleModule {}