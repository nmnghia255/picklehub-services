import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { NotificationModule } from '../notification/notification.module';
import { OAuthService } from './oauth.service';
import { InvitationModule } from '../invitation/invitation.module';

@Module({
    imports: [
        JwtModule.register({}),
        NotificationModule,
        InvitationModule,
    ],
    controllers: [AuthController],
    providers: [AuthService, OAuthService],
})
export class AuthModule { }

