import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../../../prisma.module";
import { MatchmakingService } from "../../matchmaking.service";
import { MatchBatchController } from "./match-batch.controller";
import { MatchBatchService } from "./match-batch.service";

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [MatchBatchController],
  providers: [MatchBatchService, MatchmakingService],
  exports: [MatchBatchService],
})
export class MatchBatchModule {}
