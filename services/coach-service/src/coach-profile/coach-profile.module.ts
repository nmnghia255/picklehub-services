import { Module } from '@nestjs/common';
import { CoachProfileController, PublicCoachController } from './coach-profile.controller';
import { CoachProfileService } from './coach-profile.service';
import { PrismaService } from '../prisma.service';
import { CoachClassService } from '../coach-class/coach-class.service';

@Module({
  controllers: [CoachProfileController, PublicCoachController],
  providers: [CoachProfileService, CoachClassService, PrismaService],
  exports: [CoachProfileService],
})
export class CoachProfileModule {}
