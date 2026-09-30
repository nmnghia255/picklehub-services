import axios from 'axios';
import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { NotificationService } from '../notification/notification.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InvitationErrors } from './errors/invitation.errors';

@Injectable()
export class InvitationService {
  private groupServiceUrl = process.env.GROUP_SERVICE_URL || 'http://localhost:4002';
  private internalToken = process.env.SERVICE_INTERNAL_TOKEN || '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  private async getInvitationFromGroup(token: string) {
    const res = await axios.get(`${this.groupServiceUrl}/internal/invitations/${token}`, { headers: { 'x-internal-token': this.internalToken } });
    return res.data;
  }

  private async acceptInvitationInGroup(token: string, userId: string) {
    const res = await axios.post(`${this.groupServiceUrl}/internal/invitations/${token}/accept`, { userId }, { headers: { 'x-internal-token': this.internalToken } });
    return res.data;
  }

  private async issueTokens(userId: string, role: UserRole): Promise<{ accessToken: string; refreshToken: string; }> {
    const payload = { sub: userId, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: (this.configService.get('JWT_ACCESS_EXPIRATION') ?? '15m') as any,
      }),
      this.jwtService.signAsync({ sub: userId }, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: (this.configService.get('JWT_REFRESH_EXPIRATION') ?? '7d') as any,
      }),
    ]);

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    return { accessToken, refreshToken };
  }

  async getInvitationByToken(token: string) {
    return this.getInvitationFromGroup(token);
  }

  async acceptInvitation(token: string, _dto: AcceptInvitationDto, currentUser?: { id: string; email: string }) {
    // 1. Get invitation metadata from group-service
    const invitation = await this.getInvitationFromGroup(token);

    if (currentUser) {
      if (currentUser.email !== invitation.email) {
        throw new ForbiddenException(InvitationErrors.INVITATION_EMAIL_MISMATCH);
      }
      return this.joinGroupAfterLogin(token, currentUser.id, currentUser.email);
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: invitation.email } });

    if (existingUser) {
      // call group service to add member and accept invitation
      const acceptResult = await this.acceptInvitationInGroup(token, existingUser.id);
      
      const tokens = await this.issueTokens(existingUser.id, existingUser.role);
      return {
        ...tokens,
        isNewUser: false,
        groupJoined: acceptResult.groupJoined ?? true,
        user: { id: existingUser.id, email: existingUser.email, displayName: existingUser.name ?? invitation.email.split('@')[0] },
        group: acceptResult.group,
      };
    }

    const displayName = invitation.email.split('@')[0];
    const newUser = await this.prisma.user.create({
      data: {
        email: invitation.email,
        name: displayName,
        passwordHash: null,
        status: UserStatus.ACTIVE,
        isVerified: true,
      },
    });

    const acceptResult = await this.acceptInvitationInGroup(token, newUser.id);
    const tokens = await this.issueTokens(newUser.id, newUser.role);

    return {
      ...tokens,
      isNewUser: true,
      groupJoined: acceptResult.groupJoined ?? true,
      user: { id: newUser.id, email: newUser.email, displayName },
      group: acceptResult.group,
    };
  }

  async joinGroupAfterLogin(token: string, currentUserId: string, currentUserEmail: string) {
    const acceptResult = await this.acceptInvitationInGroup(token, currentUserId);
    return {
      message: 'Successfully joined group.',
      groupJoined: acceptResult.groupJoined ?? true,
      group: acceptResult.group,
    };
  }

}
