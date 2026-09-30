import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Conversation, Message, MessageType, ParticipantRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuthClient } from '../clients/auth.client';
import { FriendClient } from '../clients/friend.client';
import { GroupClient } from '../clients/group.client';
import { EventClient } from '../clients/event.client';
import { TournamentClient } from '../clients/tournament.client';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authClient: AuthClient,
    private readonly friendClient: FriendClient,
    private readonly groupClient: GroupClient,
    private readonly eventClient: EventClient,
    private readonly tournamentClient: TournamentClient,
  ) {}

  async listConversations(userId: string, query: ListConversationsQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(Math.max(1, Number(query.limit ?? 20)), 100);
    const skip = (page - 1) * limit;

    const where = {
      userId,
      deletedAt: null,
    };

    const [total, participants] = await this.prisma.$transaction([
      this.prisma.conversationParticipant.count({ where }),
      this.prisma.conversationParticipant.findMany({
        where,
        orderBy: { conversation: { lastMessageAt: 'desc' } },
        skip,
        take: limit,
        include: {
          conversation: {
            include: {
              participants: true,
              messages: {
                where: { deletedAt: null },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    const data = await Promise.all(
      participants.map((participant) =>
        this.toConversationResponse(
          participant.conversation,
          userId,
          participant.lastReadAt,
        ),
      ),
    );

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async createDirectConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('You cannot create a direct conversation with yourself');
    }

    await this.authClient.getUser(targetUserId);
    await this.friendClient.assertFriends(userId, targetUserId);

    const [directUserAId, directUserBId] = [userId, targetUserId].sort();

    const conversation = await this.prisma.conversation.upsert({
      where: {
        conversations_direct_pair_uidx: {
          directUserAId,
          directUserBId,
        },
      },
      update: {},
      create: {
        type: 'DIRECT',
        directUserAId,
        directUserBId,
        participants: {
          create: [
            { userId: directUserAId, role: ParticipantRole.MEMBER },
            { userId: directUserBId, role: ParticipantRole.MEMBER },
          ],
        },
      },
      include: {
        participants: true,
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    await this.restoreParticipant(conversation.id, userId);
    return this.toConversationResponse(conversation, userId);
  }

  async createGroupConversation(userId: string, groupId: string) {
    const access = await this.groupClient.assertGroupAccess(groupId, userId);

    const conversation = await this.prisma.conversation.upsert({
      where: { groupId },
      update: {},
      create: {
        type: 'GROUP',
        groupId,
        participants: {
          create: {
            userId,
            role:
              access.role === 'OWNER'
                ? ParticipantRole.OWNER
                : ParticipantRole.MEMBER,
          },
        },
      },
      include: {
        participants: true,
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    await this.prisma.conversationParticipant.upsert({
      where: {
        conversation_participants_conversation_user_uidx: {
          conversationId: conversation.id,
          userId,
        },
      },
      update: {
        deletedAt: null,
        role:
          access.role === 'OWNER'
            ? ParticipantRole.OWNER
            : ParticipantRole.MEMBER,
      },
      create: {
        conversationId: conversation.id,
        userId,
        role:
          access.role === 'OWNER'
            ? ParticipantRole.OWNER
            : ParticipantRole.MEMBER,
      },
    });

    return this.getConversation(userId, conversation.id);
  }

  async createSocialConversation(userId: string, socialId: string) {
    const access = await this.eventClient.assertSocialAccess(socialId, userId);

    const conversation = await this.prisma.conversation.upsert({
      where: { socialId },
      update: {},
      create: {
        type: 'SOCIAL',
        socialId,
        participants: {
          create: {
            userId,
            role:
              access.role === 'HOST'
                ? ParticipantRole.OWNER
                : ParticipantRole.MEMBER,
          },
        },
      },
      include: {
        participants: true,
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    await this.prisma.conversationParticipant.upsert({
      where: {
        conversation_participants_conversation_user_uidx: {
          conversationId: conversation.id,
          userId,
        },
      },
      update: {
        deletedAt: null,
        role:
          access.role === 'HOST'
            ? ParticipantRole.OWNER
            : ParticipantRole.MEMBER,
      },
      create: {
        conversationId: conversation.id,
        userId,
        role:
          access.role === 'HOST'
            ? ParticipantRole.OWNER
            : ParticipantRole.MEMBER,
      },
    });

    return this.getConversation(userId, conversation.id);
  }

  async createTournamentConversation(userId: string, tournamentId: string) {
    const access = await this.tournamentClient.assertTournamentAccess(
      tournamentId,
      userId,
    );

    const conversation = await this.prisma.conversation.upsert({
      where: { tournamentId },
      update: {},
      create: {
        type: 'TOURNAMENT',
        tournamentId,
        participants: {
          create: {
            userId,
            role:
              access.role === 'ORGANIZER' || access.role === 'ADMIN'
                ? ParticipantRole.OWNER
                : ParticipantRole.MEMBER,
          },
        },
      },
      include: {
        participants: true,
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    await this.prisma.conversationParticipant.upsert({
      where: {
        conversation_participants_conversation_user_uidx: {
          conversationId: conversation.id,
          userId,
        },
      },
      update: {
        deletedAt: null,
        role:
          access.role === 'ORGANIZER' || access.role === 'ADMIN'
            ? ParticipantRole.OWNER
            : ParticipantRole.MEMBER,
      },
      create: {
        conversationId: conversation.id,
        userId,
        role:
          access.role === 'ORGANIZER' || access.role === 'ADMIN'
            ? ParticipantRole.OWNER
            : ParticipantRole.MEMBER,
      },
    });

    return this.getConversation(userId, conversation.id);
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.findAccessibleConversation(userId, conversationId);
    return this.toConversationResponse(conversation, userId);
  }

  async markRead(userId: string, conversationId: string, messageId: string) {
    await this.findAccessibleConversation(userId, conversationId);

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, deletedAt: null },
    });
    if (!message) throw new NotFoundException('Message not found');

    const updated = await this.prisma.conversationParticipant.update({
      where: {
        conversation_participants_conversation_user_uidx: {
          conversationId,
          userId,
        },
      },
      data: {
        lastReadMessageId: messageId,
        lastReadAt: message.createdAt,
      },
    });

    return {
      conversationId,
      userId,
      lastReadMessageId: updated.lastReadMessageId,
      lastReadAt: updated.lastReadAt,
    };
  }

  async mute(userId: string, conversationId: string, mutedUntil?: string | null) {
    await this.findAccessibleConversation(userId, conversationId);

    const updated = await this.prisma.conversationParticipant.update({
      where: {
        conversation_participants_conversation_user_uidx: {
          conversationId,
          userId,
        },
      },
      data: {
        mutedUntil: mutedUntil ? new Date(mutedUntil) : null,
      },
    });

    return {
      conversationId,
      userId,
      mutedUntil: updated.mutedUntil,
    };
  }

  async hide(userId: string, conversationId: string) {
    await this.findAccessibleConversation(userId, conversationId);

    await this.prisma.conversationParticipant.update({
      where: {
        conversation_participants_conversation_user_uidx: {
          conversationId,
          userId,
        },
      },
      data: { deletedAt: new Date() },
    });

    return { message: 'Conversation hidden successfully.' };
  }

  async findAccessibleConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const participant = conversation.participants.find((item) => item.userId === userId);
    if (participant && !participant.deletedAt) return conversation;

    if (conversation.type === 'GROUP' && conversation.groupId) {
      const access = await this.groupClient.assertGroupAccess(conversation.groupId, userId);
      await this.prisma.conversationParticipant.upsert({
        where: {
          conversation_participants_conversation_user_uidx: {
            conversationId,
            userId,
          },
        },
        update: {
          deletedAt: null,
          role:
            access.role === 'OWNER'
              ? ParticipantRole.OWNER
              : ParticipantRole.MEMBER,
        },
        create: {
          conversationId,
          userId,
          role:
            access.role === 'OWNER'
              ? ParticipantRole.OWNER
              : ParticipantRole.MEMBER,
        },
      });
      return this.prisma.conversation.findUniqueOrThrow({
        where: { id: conversationId },
        include: {
          participants: true,
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
    }

    if (conversation.type === 'SOCIAL' && conversation.socialId) {
      const access = await this.eventClient.assertSocialAccess(
        conversation.socialId,
        userId,
      );
      await this.prisma.conversationParticipant.upsert({
        where: {
          conversation_participants_conversation_user_uidx: {
            conversationId,
            userId,
          },
        },
        update: {
          deletedAt: null,
          role:
            access.role === 'HOST'
              ? ParticipantRole.OWNER
              : ParticipantRole.MEMBER,
        },
        create: {
          conversationId,
          userId,
          role:
            access.role === 'HOST'
              ? ParticipantRole.OWNER
              : ParticipantRole.MEMBER,
        },
      });
      return this.reloadConversation(conversationId);
    }

    if (conversation.type === 'TOURNAMENT' && conversation.tournamentId) {
      const access = await this.tournamentClient.assertTournamentAccess(
        conversation.tournamentId,
        userId,
      );
      await this.prisma.conversationParticipant.upsert({
        where: {
          conversation_participants_conversation_user_uidx: {
            conversationId,
            userId,
          },
        },
        update: {
          deletedAt: null,
          role:
            access.role === 'ORGANIZER' || access.role === 'ADMIN'
              ? ParticipantRole.OWNER
              : ParticipantRole.MEMBER,
        },
        create: {
          conversationId,
          userId,
          role:
            access.role === 'ORGANIZER' || access.role === 'ADMIN'
              ? ParticipantRole.OWNER
              : ParticipantRole.MEMBER,
        },
      });
      return this.reloadConversation(conversationId);
    }

    throw new ForbiddenException('You cannot access this conversation');
  }

  async toConversationResponse(
    conversation: Conversation & {
      participants: { userId: string; role: ParticipantRole; lastReadAt: Date | null; mutedUntil: Date | null; deletedAt: Date | null }[];
      messages?: Message[];
    },
    viewerId: string,
    viewerLastReadAt?: Date | null,
  ) {
    const activeParticipants = conversation.participants.filter((item) => !item.deletedAt);
    const users = await this.authClient.getUsers(activeParticipants.map((item) => item.userId));
    const lastMessage = conversation.messages?.[0] ?? null;
    const lastReadAt =
      viewerLastReadAt ??
      activeParticipants.find((item) => item.userId === viewerId)?.lastReadAt ??
      null;

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: conversation.id,
        deletedAt: null,
        senderId: { not: viewerId },
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });

    const group =
      conversation.type === 'GROUP' && conversation.groupId
        ? await this.safeGroupSummary(conversation.groupId)
        : null;

    return {
      id: conversation.id,
      type: conversation.type,
      groupId: conversation.groupId,
      socialId: conversation.socialId,
      tournamentId: conversation.tournamentId,
      group,
      social:
        conversation.type === 'SOCIAL' && conversation.socialId
          ? await this.safeSocialSummary(conversation.socialId, viewerId)
          : null,
      tournament:
        conversation.type === 'TOURNAMENT' && conversation.tournamentId
          ? await this.safeTournamentSummary(conversation.tournamentId, viewerId)
          : null,
      participants: activeParticipants.map((participant) => {
        const user = users.get(participant.userId);
        return {
          userId: participant.userId,
          role: participant.role,
          mutedUntil: participant.mutedUntil,
          user: user
            ? { id: user.id, name: user.name, email: user.email, role: user.role }
            : null,
        };
      }),
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            senderId: lastMessage.senderId,
            type: lastMessage.type,
            body: lastMessage.body,
            mediaUrl: lastMessage.mediaUrl,
            createdAt: lastMessage.createdAt,
          }
        : null,
      unreadCount,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  private async restoreParticipant(conversationId: string, userId: string) {
    await this.prisma.conversationParticipant.update({
      where: {
        conversation_participants_conversation_user_uidx: {
          conversationId,
          userId,
        },
      },
      data: { deletedAt: null },
    });
  }

  private async safeGroupSummary(groupId: string) {
    try {
      return await this.groupClient.getGroup(groupId);
    } catch {
      return null;
    }
  }

  private async safeSocialSummary(socialId: string, viewerId: string) {
    try {
      return (await this.eventClient.assertSocialAccess(socialId, viewerId)).social;
    } catch {
      return null;
    }
  }

  private async safeTournamentSummary(tournamentId: string, viewerId: string) {
    try {
      return (await this.tournamentClient.assertTournamentAccess(tournamentId, viewerId))
        .tournament;
    } catch {
      return null;
    }
  }

  private reloadConversation(conversationId: string) {
    return this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        participants: true,
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }
}
