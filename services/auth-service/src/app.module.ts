import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { PasswordModule } from './password/password.module';
import { InvitationModule } from './invitation/invitation.module';
import { ConfigModule } from '@nestjs/config';
import { InternalUsersController } from './internal/users.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    PasswordModule,
    InvitationModule,
  ],
  controllers: [AppController, InternalUsersController],
  providers: [AppService],
})
export class AppModule { }
