import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma.module';
import { PlaySessionParticipantController } from './play-session-participant.controller';
import { PlaySessionParticipantService } from './play-session-participant.service';
import { SocialParticipantModule } from '../../participant/social-participant.module';
import { UserModule } from '../../../user/user.module';

@Module({
  imports: [PrismaModule, SocialParticipantModule, UserModule],
  controllers: [PlaySessionParticipantController],
  providers: [PlaySessionParticipantService],
  exports: [PlaySessionParticipantService],
})
export class PlaySessionParticipantModule {}
