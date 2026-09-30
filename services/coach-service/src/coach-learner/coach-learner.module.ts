import { Module } from '@nestjs/common';
import { CoachLearnerController } from './coach-learner.controller';
import { CoachLearnerService } from './coach-learner.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CoachLearnerController],
  providers: [CoachLearnerService, PrismaService],
})
export class CoachLearnerModule {}