import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { WsAuthGuard } from '../guards/ws-auth.guard';
import { ChatEventsModule } from './chat-events.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [ConversationsModule, MessagesModule, ChatEventsModule],
  providers: [ChatGateway, WsAuthGuard],
})
export class RealtimeModule {}
