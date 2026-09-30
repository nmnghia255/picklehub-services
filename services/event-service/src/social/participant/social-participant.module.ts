import { Module } from "@nestjs/common";
import { NotificationModule } from "../../notification/notification.module";
import { PrismaModule } from "../../prisma.module";
import { SocialParticipantController } from "./social-participant.controller";
import { SocialParticipantService } from "./social-participant.service";
import { UserModule } from "../../user/user.module";
import { ChatClient } from "../../clients/chat.client";

@Module({
  imports: [PrismaModule, NotificationModule, UserModule],
  controllers: [SocialParticipantController],
  providers: [SocialParticipantService, ChatClient],
  exports: [SocialParticipantService],
})
export class SocialParticipantModule {}
