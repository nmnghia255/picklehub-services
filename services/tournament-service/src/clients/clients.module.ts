import { Global, Module } from '@nestjs/common';
import { MatchClient } from './match.client';
import { SportCenterClient } from './sport-center.client';
import { NotificationClient } from './notification.client';
import { UserClient } from './user.client';
import { ChatClient } from './chat.client';

/**
 * Outbound service clients. Marked `@Global` so
 * any feature module can inject a client without re-importing this module.
 */
@Global()
@Module({
  providers: [MatchClient, SportCenterClient, NotificationClient, UserClient, ChatClient],
  exports: [MatchClient, SportCenterClient, NotificationClient, UserClient, ChatClient],
})
export class ClientsModule {}
