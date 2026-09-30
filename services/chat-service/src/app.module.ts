import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { RealtimeModule } from './realtime/realtime.module';
import { InternalModule } from './internal/internal.module';

@Module({
  imports: [
    PrismaModule,
    ConversationsModule,
    MessagesModule,
    RealtimeModule,
    InternalModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
