import { Module } from '@nestjs/common';
import { CoachCertificationController, AdminCertificationController } from './coach-certification.controller';
import { CoachCertificationService } from './coach-certification.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CoachCertificationController, AdminCertificationController],
  providers: [CoachCertificationService, PrismaService],
})
export class CoachCertificationModule {}
