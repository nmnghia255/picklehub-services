import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { MessagesModule } from '../messages/messages.module';
import { ChatEventsModule } from '../realtime/chat-events.module';
import { InternalTokenGuard } from '../guards/internal-token.guard';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';

@Module({
  imports: [PrismaModule, MessagesModule, ChatEventsModule],
  controllers: [InternalController],
  providers: [InternalService, InternalTokenGuard],
})
export class InternalModule {}
