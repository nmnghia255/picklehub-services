import { Module } from '@nestjs/common';
import { LearnerEnrollmentController, CoachEnrollmentController } from './class-enrollment.controller';
import { ClassEnrollmentService } from './class-enrollment.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [LearnerEnrollmentController, CoachEnrollmentController],
  providers: [ClassEnrollmentService, PrismaService],
})
export class ClassEnrollmentModule {}
