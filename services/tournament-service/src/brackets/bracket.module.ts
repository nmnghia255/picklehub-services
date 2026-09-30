import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BracketController } from './bracket.controller';
import { BracketService } from './bracket.service';

@Module({
  imports: [PrismaModule],
  controllers: [BracketController],
  providers: [BracketService],
  exports: [BracketService],
})
export class BracketModule {}
