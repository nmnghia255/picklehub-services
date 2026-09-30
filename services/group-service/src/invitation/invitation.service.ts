import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { createHash, randomBytes } from 'crypto';
import axios from 'axios';
import { ChatClient } from '../clients/chat.client';

const INTERNAL_HEADER = 'x-internal-token';
const INTERNAL_SERVICE_HEADER = 'x-internal-service-token';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatClient: ChatClient,
  ) { }

  private checkInternalToken(headers: any) {
    const token = process.env.SERVICE_INTERNAL_TOKEN;
    if (!token) throw new ForbiddenException('Internal token not configured');
    if (headers[INTERNAL_HEADER] !== token) throw new ForbiddenException('Invalid internal token');
  }

  private hashToken(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  private get notificationServiceUrl() {
    return process.env.NOTIFICATION_SERVICE_URL ?? 'http://notification-service:8002/api/notification';
  }

  private get notificationServiceToken() {
    return process.env.SERVICE_INTERNAL_TOKEN ?? '';
  }

  private async notifyToSendInvitationEmail(email: string, inviterName: string, invitationUrl: string, groupName: string) {
    const url = `${this.notificationServiceUrl}/email/send`;
    await axios.post(
      url,
      {
        to: email,
        template: 'invitation',
        context: {
          inviterName,
          invitationLink: invitationUrl,
          groupName,
          groupSuffix: ` - ${groupName}`,
        },
      },
      {
        headers: { [INTERNAL_SERVICE_HEADER]: this.notificationServiceToken },
      },
    );
  }

  async createEmailInvitation(headers: any, groupId: string, targetEmail: string) {
    this.checkInternalToken(headers);

    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('group not found');

    // guard duplicate pending invitation
    const existing = await this.prisma.invitation.findFirst({ where: { targetEmail, groupId, status: 'PENDING', expiresAt: { gt: new Date() } } });
    if (existing) throw new ConflictException('invitation already pending');

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({ data: { inviterId: headers['x-inviter-id'] ?? '', targetEmail, groupId, tokenHash, expiresAt, status: 'PENDING' } });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const invitationUrl = `${frontendUrl}/invitation/accept?token=${rawToken}`;

    // ask notification-service to send email
    try {
      await this.notifyToSendInvitationEmail(targetEmail, headers['x-inviter-name'] ?? '', invitationUrl, group.name);
    } catch (err) {
      this.logger.warn('Failed to notify notification-service to send invitation email', err as any);
    }

    return { id: invitation.id, email: targetEmail, status: invitation.status.toLowerCase(), expiresAt: invitation.expiresAt, createdAt: invitation.createdAt };
  }

  async getInvitationByToken(headers: any, token: string) {
    this.checkInternalToken(headers);
    const tokenHash = this.hashToken(token);
    const invitation = await this.prisma.invitation.findUnique({ where: { tokenHash }, include: { group: { select: { id: true, name: true, maxMembers: true } } } });
    if (!invitation) throw new NotFoundException('invitation not found');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('invitation expired');
    return { id: invitation.id, email: invitation.targetEmail, group: invitation.group ? { id: invitation.group!.id, name: invitation.group!.name, maxMembers: invitation.group?.maxMembers } : null, status: invitation.status.toLowerCase(), expiresAt: invitation.expiresAt };
  }

  async listGroupInvitations(headers: any, groupId: string) {
    this.checkInternalToken(headers);
    const invitations = await this.prisma.invitation.findMany({ where: { groupId, targetEmail: { not: null } }, orderBy: { createdAt: 'desc' }, select: { id: true, targetEmail: true, status: true, expiresAt: true, createdAt: true } });
    return invitations.map((inv) => ({ id: inv.id, email: inv.targetEmail, status: inv.status.toLowerCase(), expiresAt: inv.expiresAt, createdAt: inv.createdAt }));
  }

  async revokeInvitation(headers: any, groupId: string, invitationId: string) {
    this.checkInternalToken(headers);
    const invitation = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.groupId !== groupId || invitation.targetEmail === null) throw new NotFoundException('invitation not found');
    if (invitation.status !== 'PENDING') throw new ConflictException('invitation not revokable');
    await this.prisma.invitation.update({ where: { id: invitationId }, data: { status: 'REVOKED' } });
    return { message: 'Invitation revoked.' };
  }

  async acceptInvitation(headers: any, token: string, userId: string) {
    // Check token
    this.checkInternalToken(headers);

    // Hash token and find invitation
    const tokenHash = this.hashToken(token);

    // Run the transaction, then sync chat outside it so a chat failure
    // never rolls back the group membership write.
    const result = await this.prisma.$transaction(async (tx) => {
      // Find invitation and group
      const invitation = await tx.invitation.findUnique({
        where: { tokenHash },
        include: { group: true }
      });

      // Validate existence
      if (!invitation)
        throw new NotFoundException('invitation not found');

      // Validate expiration
      if (invitation.expiresAt < new Date())
        throw new BadRequestException('invitation expired');

      // Validate status
      if (invitation.status !== 'PENDING')
        throw new ConflictException('invitation not pending');

      // Validate group
      if (!invitation.groupId || !invitation.group)
        throw new NotFoundException('group not found');

      // check if already member
      const existed = await tx.groupMember.findUnique({
        where: {
          userId_groupId: {
            userId,
            groupId: invitation.groupId,
          }
        }
      });

      let joined = false;

      if (!existed) {
        const memberCount = await tx.groupMember.count({
          where: {
            groupId: invitation.groupId
          }
        });

        if (invitation.group?.maxMembers != null &&
          memberCount >= invitation.group?.maxMembers) {

          // update invitation status
          await tx.invitation.update({
            where: { tokenHash },
            data: { status: 'ACCEPTED' }
          });

          return {
            groupJoined: joined,
            group: invitation.group
              ? {
                id: invitation.group!.id,
                name: invitation.group!.name
              }
              : null
          };
        }

        // add member
        await tx.groupMember.create({
          data: {
            groupId: invitation.groupId,
            userId,
            role: 'MEMBER',
          }
        });

        joined = true;
      }
      // update invitation status
      await tx.invitation.update({
        where: { tokenHash },
        data: { status: 'ACCEPTED' }
      });

      return {
        groupJoined: joined,
        group: invitation.group
          ? {
            id: invitation.group!.id,
            name: invitation.group!.name
          }
          : null
      }
    });

    // Fire-and-forget: sync full group member list to chat-service after new member joins
    if (result.groupJoined && result.group?.id) {
      const allMembers = await this.prisma.groupMember.findMany({
        where: { groupId: result.group.id },
        select: { userId: true },
      });
      this.chatClient.syncGroupChat(result.group.id, allMembers.map((m) => m.userId));
    }

    return result;
  }
}

