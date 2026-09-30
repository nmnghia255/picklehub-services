import { Module } from '@nestjs/common';
import { ClassScheduleController } from './class-schedule.controller';
import { ClassScheduleService } from './class-schedule.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ClassScheduleController],
  providers: [ClassScheduleService, PrismaService],
})
export class ClassScheduleModule {}
