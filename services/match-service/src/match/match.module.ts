import { Module } from '@nestjs/common';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { LivescoreGateway } from '../livescore/livescore.gateway';
import { PrismaService } from '../prisma.service';
import { AuthProxyGuard } from '../guards/auth-proxy.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { InternalTokenGuard } from '../guards/internal-token.guard';
import { WsAuthGuard } from '../livescore/guards/ws-auth.guard';
import { BullModule } from '@nestjs/bullmq';
import { MatchSyncProcessor } from './match-sync.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'match-sync',
    }),
  ],
  controllers: [MatchController],
  providers: [
    MatchService,
    MatchSyncProcessor,
    LivescoreGateway,
    PrismaService,
    AuthProxyGuard,
    JwtAuthGuard,
    InternalTokenGuard,
    WsAuthGuard,
  ],
  exports: [MatchService],
})
export class MatchModule {}

