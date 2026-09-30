import { Module } from '@nestjs/common';
import { CoachClassController, PublicClassController } from './coach-class.controller';
import { CoachClassService } from './coach-class.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CoachClassController, PublicClassController],
  providers: [CoachClassService, PrismaService],
  exports: [CoachClassService],
})
export class CoachClassModule {}
