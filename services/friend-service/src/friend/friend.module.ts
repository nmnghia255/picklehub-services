import { Module } from '@nestjs/common';
import { FriendController } from './friend.controller';
import { FriendService } from './friend.service';
import { PrismaService } from '../prisma.service';
import { AuthProxyGuard } from '../guards/auth-proxy.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { InternalFriendController } from './internal-friend.controller';

@Module({
  controllers: [FriendController, InternalFriendController],
  providers: [FriendService, PrismaService, AuthProxyGuard, JwtAuthGuard],
  exports: [FriendService],
})
export class FriendModule {}
