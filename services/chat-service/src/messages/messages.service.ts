import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Message, MessageType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuthClient } from '../clients/auth.client';
import { NotificationClient } from '../clients/notification.client';
import { ConversationsService } from '../conversations/conversations.service';
import { ChatEventsService } from '../realtime/chat-events.service';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authClient: AuthClient,
    private readonly notificationClient: NotificationClient,
    private readonly conversationsService: ConversationsService,
    private readonly chatEvents: ChatEventsService,
  ) {}

  async listMessages(userId: string, conversationId: string, query: ListMessagesQueryDto) {
    await this.conversationsService.findAccessibleConversation(userId, conversationId);

    const limit = Math.min(Math.max(1, Number(query.limit ?? 50)), 100);

    // Search mode: keyword filter across all messages (ignores before cursor)
    if (query.search) {
      const messages = await this.prisma.message.findMany({
        where: {
          conversationId,
          deletedAt: null,
          body: { contains: query.search, mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return {
        data: await this.toMessageResponses(messages),
        meta: { limit, nextBefore: null, search: query.search },
      };
    }

    // Cursor-based pagination mode
    const beforeMessage = query.before
      ? await this.prisma.message.findFirst({
          where: { id: query.before, conversationId, deletedAt: null },
        })
      : null;

    if (query.before && !beforeMessage) {
      throw new NotFoundException('Cursor message not found');
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...(beforeMessage ? { createdAt: { lt: beforeMessage.createdAt } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      data: await this.toMessageResponses(messages),
      meta: {
        limit,
        nextBefore: messages.length === limit ? messages[messages.length - 1].id : null,
      },
    };
  }

  async sendMessage(userId: string, conversationId: string, dto: SendMessageDto) {
    await this.conversationsService.findAccessibleConversation(userId, conversationId);

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          senderId: userId,
          type: dto.type ?? MessageType.TEXT,
          body: dto.body,
          mediaUrl: dto.mediaUrl,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageId: created.id,
          lastMessageAt: created.createdAt,
        },
      });

      await tx.conversationParticipant.update({
        where: {
          conversation_participants_conversation_user_uidx: {
            conversationId,
            userId,
          },
        },
        data: {
          lastReadMessageId: created.id,
          lastReadAt: created.createdAt,
          deletedAt: null,
        },
      });

      await tx.conversationParticipant.updateMany({
        where: {
          conversationId,
          deletedAt: { not: null },
        },
        data: { deletedAt: null },
      });

      return created;
    });

    const response = (await this.toMessageResponses([message]))[0];
    this.chatEvents.emitToConversation(conversationId, 'message-created', response);
    this.chatEvents.emitToConversation(conversationId, 'conversation-updated', {
      conversationId,
      lastMessage: response,
    });

    await this.notifyRecipients(userId, conversationId, message);
    return response;
  }

  async editMessage(userId: string, conversationId: string, messageId: string, dto: EditMessageDto) {
    await this.conversationsService.findAccessibleConversation(userId, conversationId);

    const existing = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Message not found');
    if (existing.senderId !== userId) throw new ForbiddenException('You can only edit your own messages');
    if (existing.type !== MessageType.TEXT) throw new ForbiddenException('Only TEXT messages can be edited');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        body: dto.body,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        editedAt: new Date(),
      },
    });

    const response = (await this.toMessageResponses([updated]))[0];
    this.chatEvents.emitToConversation(conversationId, 'message-updated', response);
    return response;
  }

  async deleteMessage(userId: string, conversationId: string, messageId: string) {
    await this.conversationsService.findAccessibleConversation(userId, conversationId);

    const existing = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Message not found');
    if (existing.senderId !== userId) throw new ForbiddenException('You can only delete your own messages');

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    this.chatEvents.emitToConversation(conversationId, 'message-deleted', {
      conversationId,
      messageId,
    });

    return { message: 'Message deleted.' };
  }

  async toMessageResponses(messages: Message[]) {
    const users = await this.authClient.getUsers(messages.map((message) => message.senderId));
    return messages.map((message) => {
      const sender = users.get(message.senderId);
      return {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        sender: sender
          ? {
              id: sender.id,
              name: sender.name,
              email: sender.email,
              role: sender.role,
            }
          : null,
        type: message.type,
        body: message.body,
        mediaUrl: message.mediaUrl,
        metadata: message.metadata,
        editedAt: message.editedAt,
        deletedAt: message.deletedAt,
        createdAt: message.createdAt,
      };
    });
  }

  private async notifyRecipients(senderId: string, conversationId: string, message: Message) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        userId: { not: senderId },
        deletedAt: null,
        OR: [{ mutedUntil: null }, { mutedUntil: { lt: new Date() } }],
      },
    });

    if (participants.length === 0) return;

    const sender = await this.authClient.getUsers([senderId]);
    const senderName = sender.get(senderId)?.name ?? 'PickleHub';
    const preview =
      message.type === MessageType.MEDIA
        ? 'Sent a media message'
        : (message.body ?? '').slice(0, 120);

    await this.notificationClient.sendMany({
      userIds: participants.map((participant) => participant.userId),
      title: `New message from ${senderName}`,
      message: preview || 'New message',
      metadata: {
        onClickSupport: {
          conversationId,
          messageId: message.id,
          type: 'chat',
        },
      },
    });
  }
}
