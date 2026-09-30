import { Module } from '@nestjs/common';
import { AuthClient } from './auth.client';
import { FriendClient } from './friend.client';
import { GroupClient } from './group.client';
import { NotificationClient } from './notification.client';
import { EventClient } from './event.client';
import { TournamentClient } from './tournament.client';

@Module({
  providers: [
    AuthClient,
    FriendClient,
    GroupClient,
    EventClient,
    TournamentClient,
    NotificationClient,
  ],
  exports: [
    AuthClient,
    FriendClient,
    GroupClient,
    EventClient,
    TournamentClient,
    NotificationClient,
  ],
})
export class ClientsModule {}
