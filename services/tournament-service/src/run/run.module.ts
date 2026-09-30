import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdvancementModule } from '../advancement/advancement.module';
import { RunController } from './run.controller';
import { RunService } from './run.service';

@Module({
  imports: [PrismaModule, AdvancementModule],
  controllers: [RunController],
  providers: [RunService],
  exports: [RunService],
})
export class RunModule {}
