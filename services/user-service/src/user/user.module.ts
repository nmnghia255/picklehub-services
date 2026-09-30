import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma.module';
import { AuthProxyGuard } from '../guards/auth-proxy.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { InternalController } from './internal.controller';
import { CalendarController } from '../calendar/calendar.controller';
import { CalendarService } from '../calendar/calendar.service';
import { GeocodingModule } from '../geocoding/geocoding.module';

@Module({
  imports: [PrismaModule, GeocodingModule],
  controllers: [UserController, InternalController, CalendarController],
  providers: [UserService, AuthProxyGuard, JwtAuthGuard, CalendarService],
  exports: [UserService],
})
export class UserModule {}
