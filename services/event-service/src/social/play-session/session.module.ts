import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { SocialParticipantModule } from '../participant/social-participant.module';
import { UserModule } from '../../user/user.module';

@Module({
  imports: [PrismaModule, SocialParticipantModule, UserModule],
  controllers: [SessionController],
  providers: [
    SessionService,
  ],
  exports: [SessionService],
})
export class SessionModule {}
