import axios from 'axios';
import {
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InvitationErrors } from './errors/invitation.errors';

@Injectable()
export class RefereeInvitationService {
  private tournamentServiceUrl = process.env.TOURNAMENT_SERVICE_URL || 'http://tournament-service:8008';
  private internalToken = process.env.SERVICE_INTERNAL_TOKEN || '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  private async getInvitationFromTournament(token: string) {
    const res = await axios.get(
      `${this.tournamentServiceUrl}/api/tournaments/internal/referees/invitations/${token}`,
      { headers: { 'x-internal-service-token': this.internalToken }, validateStatus: () => true }
    );
    if (res.status === 404) {
      throw new NotFoundException('Invitation not found.');
    }
    if (res.status !== 200) {
      throw new Error(`Failed to fetch invitation from tournament service: status=${res.status} message=${JSON.stringify(res.data)}`);
    }
    return res.data;
  }

  private async acceptInvitationInTournament(token: string, userId: string) {
    const res = await axios.post(
      `${this.tournamentServiceUrl}/api/tournaments/internal/referees/invitations/${token}/accept`,
      { userId },
      { headers: { 'x-internal-service-token': this.internalToken }, validateStatus: () => true }
    );
    if (res.status !== 200 && res.status !== 201) {
      // Forward the error from tournament-service so NestJS returns the correct HTTP status
      throw new HttpException(
        res.data ?? { message: 'Failed to accept invitation.' },
        res.status >= 400 ? res.status : 500,
      );
    }
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
    return this.getInvitationFromTournament(token);
  }

  async acceptInvitation(token: string, _dto: AcceptInvitationDto, currentUser?: { id: string; email: string }) {
    // 1. Get invitation metadata from tournament-service
    const invitation = await this.getInvitationFromTournament(token);

    if (currentUser) {
      if (currentUser.email !== invitation.email) {
        throw new ForbiddenException(InvitationErrors.INVITATION_EMAIL_MISMATCH);
      }
      return this.joinTournamentAfterLogin(token, currentUser.id, currentUser.email);
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: invitation.email } });

    if (existingUser) {
      // call tournament service to accept invitation and enroll referee
      const acceptResult = await this.acceptInvitationInTournament(token, existingUser.id);
      
      const tokens = await this.issueTokens(existingUser.id, existingUser.role);
      return {
        ...tokens,
        isNewUser: false,
        tournamentJoined: acceptResult.success ?? true,
        user: { id: existingUser.id, email: existingUser.email, displayName: existingUser.name ?? invitation.email.split('@')[0] },
        tournament: invitation.tournament,
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

    const acceptResult = await this.acceptInvitationInTournament(token, newUser.id);
    const tokens = await this.issueTokens(newUser.id, newUser.role);

    return {
      ...tokens,
      isNewUser: true,
      tournamentJoined: acceptResult.success ?? true,
      user: { id: newUser.id, email: newUser.email, displayName },
      tournament: invitation.tournament,
    };
  }

  async joinTournamentAfterLogin(token: string, currentUserId: string, currentUserEmail: string) {
    // Validate that the logged-in user's email matches the invited email
    const invitation = await this.getInvitationFromTournament(token);
    if (invitation.email !== currentUserEmail) {
      throw new ForbiddenException(InvitationErrors.INVITATION_EMAIL_MISMATCH);
    }
    const acceptResult = await this.acceptInvitationInTournament(token, currentUserId);
    return {
      message: 'Successfully accepted referee invitation.',
      tournamentJoined: acceptResult.success ?? true,
      tournament: invitation.tournament,
    };
  }
}
