import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PasswordController } from './password.controller';
import { PasswordService } from './password.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PrismaModule } from '../prisma.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [
        PrismaModule,
        PassportModule,
        JwtModule.register({}), // Configuration is done in strategy
        NotificationModule,
    ],
    controllers: [PasswordController],
    providers: [PasswordService, JwtStrategy],
})
export class PasswordModule { }
