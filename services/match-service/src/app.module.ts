import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { MatchModule } from './match/match.module';
import { PrismaService } from './prisma.service';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    MatchModule,
  ],
  controllers: [AppController],
  providers: [PrismaService],
})
export class AppModule {}
