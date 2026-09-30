import { Module } from '@nestjs/common';
import { GroupInvitationController, InvitationInternalController } from './invitation.controller';
import { InvitationService } from './invitation.service';
import { PrismaService } from '../prisma.service';
import { ChatClient } from '../clients/chat.client';

@Module({
  controllers: [InvitationInternalController, GroupInvitationController],
  providers: [InvitationService, PrismaService, ChatClient],
  exports: [InvitationService],
})
export class InvitationModule { }
