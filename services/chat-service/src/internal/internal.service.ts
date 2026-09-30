import { Injectable } from '@nestjs/common';
import { MessageType, ParticipantRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ChatEventsService } from '../realtime/chat-events.service';
import { MessagesService } from '../messages/messages.service';

@Injectable()
export class InternalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
    private readonly chatEvents: ChatEventsService,
  ) {}

  async syncGroup(groupId: string, memberIds: string[]) {
    const conversation = await this.prisma.conversation.upsert({
      where: { groupId },
      update: {},
      create: { type: 'GROUP', groupId },
    });

    for (const userId of memberIds) {
      await this.prisma.conversationParticipant.upsert({
        where: {
          conversation_participants_conversation_user_uidx: {
            conversationId: conversation.id,
            userId,
          },
        },
        update: { deletedAt: null },
        create: {
          conversationId: conversation.id,
          userId,
          role: ParticipantRole.MEMBER,
        },
      });
    }

    await this.prisma.conversationParticipant.updateMany({
      where: {
        conversationId: conversation.id,
        ...(memberIds.length > 0 ? { userId: { notIn: memberIds } } : {}),
      },
      data: { deletedAt: new Date() },
    });

    return {
      conversationId: conversation.id,
      groupId,
      syncedMemberCount: memberIds.length,
    };
  }

  async syncSocial(socialId: string, memberIds: string[]) {
    const conversation = await this.prisma.conversation.upsert({
      where: { socialId },
      update: {},
      create: { type: 'SOCIAL', socialId },
    });

    await this.syncParticipants(conversation.id, memberIds);

    return {
      conversationId: conversation.id,
      socialId,
      syncedMemberCount: memberIds.length,
    };
  }

  async syncTournament(tournamentId: string, memberIds: string[]) {
    const conversation = await this.prisma.conversation.upsert({
      where: { tournamentId },
      update: {},
      create: { type: 'TOURNAMENT', tournamentId },
    });

    await this.syncParticipants(conversation.id, memberIds);

    return {
      conversationId: conversation.id,
      tournamentId,
      syncedMemberCount: memberIds.length,
    };
  }

  async createSystemMessage(
    conversationId: string,
    body: string,
    metadata?: Record<string, unknown>,
  ) {
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: '00000000-0000-0000-0000-000000000000',
          type: MessageType.SYSTEM,
          body,
          metadata: metadata as Prisma.InputJsonValue | undefined,
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: created.id,
          lastMessageAt: created.createdAt,
        },
      });

      return created;
    });

    const response = (await this.messagesService.toMessageResponses([message]))[0];
    this.chatEvents.emitToConversation(conversationId, 'message-created', response);
    return response;
  }

  private async syncParticipants(conversationId: string, memberIds: string[]) {
    for (const userId of memberIds) {
      await this.prisma.conversationParticipant.upsert({
        where: {
          conversation_participants_conversation_user_uidx: {
            conversationId,
            userId,
          },
        },
        update: { deletedAt: null },
        create: {
          conversationId,
          userId,
          role: ParticipantRole.MEMBER,
        },
      });
    }

    await this.prisma.conversationParticipant.updateMany({
      where: {
        conversationId,
        ...(memberIds.length > 0 ? { userId: { notIn: memberIds } } : {}),
      },
      data: { deletedAt: new Date() },
    });
  }
}
