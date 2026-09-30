import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { ClientsModule } from '../clients/clients.module';
import { AuthProxyGuard } from '../guards/auth-proxy.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [PrismaModule, ClientsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, AuthProxyGuard, JwtAuthGuard],
  exports: [ConversationsService],
})
export class ConversationsModule {}
