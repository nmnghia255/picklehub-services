import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { UserModule } from './user/user.module';
import { AppController } from './app.controller';

@Module({
  imports: [PrismaModule, UserModule],
  controllers: [AppController],
})
export class AppModule {}
