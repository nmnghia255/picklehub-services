import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationModule } from '../notification/notification.module';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';
import { RefereeInvitationController } from './referee-invitation.controller';
import { RefereeInvitationService } from './referee-invitation.service';

@Module({
  imports: [
    NotificationModule,
    JwtModule.register({}), // secrets supplied per-call via signAsync options
  ],
  controllers: [InvitationController, RefereeInvitationController],
  providers: [InvitationService, RefereeInvitationService],
  exports: [InvitationService, RefereeInvitationService],
})
export class InvitationModule {}
