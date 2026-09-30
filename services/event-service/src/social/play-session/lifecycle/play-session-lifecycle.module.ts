import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma.module";
import { PlaySessionLifecycleController } from "./play-session-lifecycle.controller";
import { PlaySessionLifecycleService } from "./play-session-lifecycle.service";
import { SocialParticipantModule } from "../../participant/social-participant.module";
import { SocialModule } from "../../social.module";

@Module({
  imports: [PrismaModule, SocialParticipantModule, SocialModule],
  controllers: [PlaySessionLifecycleController],
  providers: [PlaySessionLifecycleService],
  exports: [PlaySessionLifecycleService],
})
export class PlaySessionLifecycleModule {}
