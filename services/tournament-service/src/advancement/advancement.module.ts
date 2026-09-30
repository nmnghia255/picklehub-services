import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrizesModule } from '../prizes/prizes.module';
import { AdvancementService } from './advancement.service';
import { AdvancementController } from './advancement.controller';
import { GroupStageModule } from '../group-stage/group-stage.module';

@Module({
  imports: [PrismaModule, PrizesModule, GroupStageModule],
  controllers: [AdvancementController],
  providers: [AdvancementService],
  exports: [AdvancementService],
})
export class AdvancementModule {}
