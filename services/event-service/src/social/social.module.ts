import { Module } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { SocialService } from './social.service';
import { SocialWaitlistListener } from './social-waitlist.listener';
import { SocialController } from './social.controller';
import { InternalSocialChatController } from './internal-social-chat.controller';
import { NotificationService } from '../notification/notification.service';
import { UserModule } from '../user/user.module';
import { SocialParticipantModule } from './participant/social-participant.module';

@Module({
  imports: [UserModule, SocialParticipantModule],
  controllers: [SocialController, InternalSocialChatController],
  providers: [
    SocialService,
    MatchmakingService,
    SocialWaitlistListener,
    NotificationService,
  ],
  exports: [SocialService],
})
export class SocialModule {}
