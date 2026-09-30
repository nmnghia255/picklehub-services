import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { ClientsModule } from '../clients/clients.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { ChatEventsModule } from '../realtime/chat-events.module';
import { AuthProxyGuard } from '../guards/auth-proxy.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [PrismaModule, ClientsModule, ConversationsModule, ChatEventsModule],
  controllers: [MessagesController],
  providers: [MessagesService, AuthProxyGuard, JwtAuthGuard],
  exports: [MessagesService],
})
export class MessagesModule {}
