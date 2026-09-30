import { Module } from '@nestjs/common';
import { GroupStageService } from './group-stage.service';
import { GroupStageController } from './group-stage.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [GroupStageController],
  providers: [GroupStageService],
  exports: [GroupStageService],
})
export class GroupStageModule {}
