import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { FriendModule } from './friend/friend.module';

@Module({
  imports: [FriendModule],
  controllers: [AppController],
})
export class AppModule {}
