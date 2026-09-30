import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, Logger, HttpException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { MatchClient } from '../clients/match.client';
import { UserClient } from '../clients/user.client';
import { NotificationClient } from '../clients/notification.client';
import { TournamentsService } from '../tournaments/tournaments.service';
import { EnrollRefereeDto } from './dto/enroll-referee.dto';
import { BulkAssignRefereeDto } from './dto/bulk-assign-referee.dto';
import { MatchStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class RefereesService {
  private readonly logger = new Logger(RefereesService.name);

  constructor(
    private prisma: PrismaService,
    private readonly match: MatchClient,
    private readonly userClient: UserClient,
    private readonly notificationClient: NotificationClient,
    private readonly tournamentsService: TournamentsService,
  ) {}

  async enrollReferee(tournamentId: number, dto: EnrollRefereeDto) {
    // Check if tournament exists
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }

    // Check if already enrolled
    const existing = await this.prisma.tournamentReferee.findUnique({
      where: {
        tournamentId_refereeId: {
          tournamentId,
          refereeId: dto.refereeId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('Referee is already enrolled in this tournament.');
    }

    // Autofill name, email, avatar from User Service if not provided
    let refereeName = dto.refereeName || 'Unknown Referee';
    let refereeEmail = dto.refereeEmail || null;
    let refereeAvatar = dto.refereeAvatar || null;

    if (!dto.refereeName || !dto.refereeEmail || !dto.refereeAvatar) {
      const profile = await this.userClient.getUserProfile(dto.refereeId);
      if (profile) {
        if (!dto.refereeName) refereeName = profile.name || refereeName;
        if (!dto.refereeEmail) refereeEmail = profile.email || refereeEmail;
        if (!dto.refereeAvatar) refereeAvatar = profile.avatar || refereeAvatar;
      }
    }

    const referee = await this.prisma.tournamentReferee.create({
      data: {
        tournamentId,
        refereeId: dto.refereeId,
        refereeName,
        refereeEmail,
        refereeAvatar,
        phone: dto.phone || null,
      },
    });

    this.tournamentsService.syncTournamentChat(tournamentId);

    return referee;
  }

  async unenrollReferee(tournamentId: number, refereeId: string) {
    // Check if referee is enrolled
    const enrolled = await this.prisma.tournamentReferee.findUnique({
      where: {
        tournamentId_refereeId: {
          tournamentId,
          refereeId,
        },
      },
    });
    if (!enrolled) {
      throw new NotFoundException('Referee is not enrolled in this tournament.');
    }

    // Check if referee has active match assignments
    const activeAssignments = await this.prisma.match.findFirst({
      where: {
        tournamentId,
        refereeId,
      },
    });
    if (activeAssignments) {
      throw new BadRequestException('Cannot unenroll referee: referee has active match assignments. Unassign them first.');
    }

    await this.prisma.tournamentReferee.delete({
      where: {
        tournamentId_refereeId: {
          tournamentId,
          refereeId,
        },
      },
    });

    this.tournamentsService.syncTournamentChat(tournamentId);

    return { success: true };
  }

  async listEnrolledReferees(tournamentId: number) {
    const referees = await this.prisma.tournamentReferee.findMany({
      where: { tournamentId },
      orderBy: { enrolledAt: 'desc' },
    });

    const results = [];
    for (const ref of referees) {
      const workload = await this.prisma.match.count({
        where: {
          tournamentId,
          refereeId: ref.refereeId,
        },
      });
      results.push({
        ...ref,
        workload,
      });
    }

    return results;
  }

  async assignReferee(tournamentId: number, matchId: number, refereeId: string, authHeader?: string) {
    // Verify referee is enrolled
    const enrolled = await this.prisma.tournamentReferee.findUnique({
      where: {
        tournamentId_refereeId: {
          tournamentId,
          refereeId,
        },
      },
    });
    if (!enrolled) {
      throw new BadRequestException('Referee must be enrolled in the tournament first.');
    }

    const match = await this.prisma.match.findFirst({
      where: { id: matchId, tournamentId },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found in tournament ${tournamentId}`);
    }

    const finalRefereeName = enrolled.refereeName;

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        refereeId,
        refereeName: finalRefereeName,
      },
    });

    // If the fixture is already live in the match service, push the referee there too.
    await this.syncRefereeToMatchService(match.externalMatchId, refereeId, authHeader);

    return updated;
  }

  async bulkAssignReferee(tournamentId: number, dto: BulkAssignRefereeDto, authHeader?: string) {
    // Verify referee is enrolled
    const enrolled = await this.prisma.tournamentReferee.findUnique({
      where: {
        tournamentId_refereeId: {
          tournamentId,
          refereeId: dto.refereeId,
        },
      },
    });
    if (!enrolled) {
      throw new BadRequestException('Referee must be enrolled in the tournament first.');
    }

    // Verify all matches exist in this tournament
    const matches = await this.prisma.match.findMany({
      where: {
        id: { in: dto.matchIds },
        tournamentId,
      },
    });

    if (matches.length !== dto.matchIds.length) {
      throw new BadRequestException('Some match IDs do not exist or do not belong to this tournament.');
    }

    const finalRefereeName = enrolled.refereeName;

    await this.prisma.$transaction(async (tx) => {
      for (const mId of dto.matchIds) {
        await tx.match.update({
          where: { id: mId },
          data: {
            refereeId: dto.refereeId,
            refereeName: finalRefereeName,
          },
        });
      }
    });

    // Sync live matches asynchronously
    for (const m of matches) {
      if (m.externalMatchId) {
        await this.syncRefereeToMatchService(m.externalMatchId, dto.refereeId, authHeader);
      }
    }

    return { assignedCount: dto.matchIds.length };
  }

  async unassignReferee(tournamentId: number, matchId: number, authHeader?: string) {
    const match = await this.prisma.match.findFirst({
      where: { id: matchId, tournamentId },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${matchId} not found in tournament ${tournamentId}`);
    }

    const updated = await this.prisma.match.update({
      where: { id: matchId },
      data: {
        refereeId: null,
        refereeName: null,
      },
    });

    await this.syncRefereeToMatchService(match.externalMatchId, null, authHeader);

    return updated;
  }

  async listAllMatchesWithReferees(tournamentId: number, eventId?: number) {
    return this.prisma.match.findMany({
      where: {
        tournamentId,
        ...(eventId ? { eventId } : {}),
      },
      include: {
        event: {
          select: { name: true, type: true },
        },
        court: {
          select: { name: true },
        },
      },
      orderBy: { time: 'asc' },
    });
  }

  async listUnassignedMatches(tournamentId: number, eventId?: number) {
    return this.prisma.match.findMany({
      where: {
        tournamentId,
        refereeId: null,
        ...(eventId ? { eventId } : {}),
      },
      include: {
        event: {
          select: { name: true, type: true },
        },
        court: {
          select: { name: true },
        },
      },
      orderBy: { time: 'asc' },
    });
  }

  /** Mirror a referee (re)assignment onto the dispatched match-service match, if any. */
  private async syncRefereeToMatchService(externalMatchId: string | null, refereeId: string | null, authHeader?: string) {
    if (!externalMatchId) return;
    const result = await this.match.updateMatch(externalMatchId, { refereeId }, authHeader);
    if (!result) {
      this.logger.warn(`Could not sync referee to match-service match ${externalMatchId} (it may have already started).`);
    }
  }

  async getMyAssignments(refereeId: string, tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }

    // Check if the user is a referee in this tournament
    const refereeRecord = await this.prisma.tournamentReferee.findUnique({
      where: {
        tournamentId_refereeId: {
          tournamentId,
          refereeId,
        },
      },
    });

    const assignments = await this.prisma.match.findMany({
      where: { tournamentId, refereeId },
      include: {
        event: {
          select: { name: true, type: true },
        },
        court: {
          select: { name: true },
        },
      },
      orderBy: { time: 'asc' },
    });

    return {
      isReferee: !!refereeRecord,
      assignments,
    };
  }



  async inviteReferee(tournamentId: number, email: string) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }

    const targetEmail = email.trim().toLowerCase();

    // 1. Search user in auth-service by email
    const searchResult = await this.userClient.searchUsers(targetEmail);
    let matchedUser: any = null;

    if (searchResult && Array.isArray(searchResult.data)) {
      matchedUser = searchResult.data.find(
        (u: any) => u.email && u.email.toLowerCase() === targetEmail,
      );
    }

    // Check if already enrolled
    if (matchedUser) {
      const alreadyEnrolled = await this.prisma.tournamentReferee.findUnique({
        where: {
          tournamentId_refereeId: {
            tournamentId,
            refereeId: matchedUser.id,
          },
        },
      });
      if (alreadyEnrolled) {
        throw new BadRequestException('User is already a referee in this tournament.');
      }
    }

    // 2. Check for duplicate pending invitation & 5-minute spam cooldown
    const lastInvitation = await this.prisma.tournamentRefereeInvitation.findFirst({
      where: {
        tournamentId,
        email: targetEmail,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (lastInvitation) {
      const diffMs = Date.now() - lastInvitation.createdAt.getTime();
      const diffMins = diffMs / (1000 * 60);

      if (diffMins < 5) {
        throw new BadRequestException(
          'Please wait 5 minutes before sending another invitation to this email.',
        );
      }
    }

    // 3. Create or update invitation
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.prisma.tournamentRefereeInvitation.upsert({
      where: {
        tournamentId_email: {
          tournamentId,
          email: targetEmail,
        },
      },
      create: {
        tournamentId,
        email: targetEmail,
        token,
        status: 'PENDING',
        expiresAt,
      },
      update: {
        token,
        status: 'PENDING',
        expiresAt,
        createdAt: new Date(), // Reset cooldown
      },
    });

    // 4. Send email invitation via notification-service
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const invitationUrl = `${frontendUrl}/referees/invitations/accept?token=${token}`;

    const emailSent = await this.notificationClient.sendEmail(
      targetEmail,
      'referee_invitation',
      {
        invitationUrl,
        tournamentName: tournament.name,
      },
      `Lời mời làm trọng tài cho giải đấu ${tournament.name}`,
    );

    if (!emailSent) {
      // Clean up the created invitation so cooldown doesn't prevent immediate retry
      await this.prisma.tournamentRefereeInvitation.delete({
        where: {
          tournamentId_email: {
            tournamentId,
            email: targetEmail,
          },
        },
      });

      throw new InternalServerErrorException(
        'Gửi email thư mời thất bại. Vui lòng kiểm tra lại và thử lại sau.',
      );
    }

    // 5. Send in-app notification if the user exists
    if (matchedUser) {
      await this.notificationClient.sendInAppNotification(
        [matchedUser.id],
        'Lời mời làm trọng tài',
        `Bạn nhận được lời mời làm trọng tài cho giải đấu ${tournament.name}. Vui lòng kiểm tra email hoặc chấp nhận trong ứng dụng.`,
      );
    }

    return {
      success: true,
      message: 'Invitation sent successfully.',
      email: targetEmail,
      status: 'pending',
    };
  }

  async getInvitationByTokenInternal(token: string) {
    const invitation = await this.prisma.tournamentRefereeInvitation.findUnique({
      where: { token },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    return {
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      tournament: invitation.tournament,
    };
  }

  async getInvitationByToken(token: string, tournamentId: number) {
    const invitation = await this.prisma.tournamentRefereeInvitation.findUnique({
      where: { token },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation || invitation.tournamentId !== tournamentId) {
      throw new NotFoundException('Invitation not found.');
    }

    return {
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      tournament: invitation.tournament,
    };
  }

  async acceptInvitationInternal(token: string, userId: string) {
    const invitation = await this.prisma.tournamentRefereeInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('This invitation is no longer pending.');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('This invitation has expired.');
    }

    // Fetch user details from user-service (optional check)
    const profile = await this.userClient.getUserProfile(userId);

    // Check if already enrolled
    const alreadyEnrolled = await this.prisma.tournamentReferee.findUnique({
      where: {
        tournamentId_refereeId: {
          tournamentId: invitation.tournamentId,
          refereeId: userId,
        },
      },
    });

    if (alreadyEnrolled) {
      await this.prisma.tournamentRefereeInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });
      return { success: true, tournamentId: invitation.tournamentId };
    }

    // Use prisma transaction to make the enrollment and acceptance atomic
    await this.prisma.$transaction(async (tx) => {
      await tx.tournamentReferee.create({
        data: {
          tournamentId: invitation.tournamentId,
          refereeId: userId,
          refereeName: profile ? (profile.fullName || profile.name || 'Unknown Referee') : invitation.email.split('@')[0],
          refereeEmail: profile ? (profile.email || invitation.email) : invitation.email,
          refereeAvatar: profile ? (profile.avatarUrl || profile.avatar || null) : null,
          phone: profile ? (profile.phoneNumber || null) : null,
        },
      });

      await tx.tournamentRefereeInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });
    });

    this.tournamentsService.syncTournamentChat(invitation.tournamentId);

    return { success: true, tournamentId: invitation.tournamentId };
  }

  private get authServiceUrl() {
    return process.env.AUTH_SERVICE_URL ?? 'http://auth-service:8001';
  }

  async listInvitations(tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }
    return this.prisma.tournamentRefereeInvitation.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async revokeInvitation(tournamentId: number, invitationId: number) {
    const invitation = await this.prisma.tournamentRefereeInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation || invitation.tournamentId !== tournamentId) {
      throw new NotFoundException(`Invitation not found`);
    }
    if (invitation.status === 'REVOKED') {
      throw new BadRequestException(`Invitation is already revoked`);
    }
    await this.prisma.tournamentRefereeInvitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });
    return { success: true };
  }

  async proxyAcceptInvitation(token: string, body: any, authHeader?: string) {
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers['authorization'] = authHeader;
    }
    const res = await axios.post(
      `${this.authServiceUrl}/api/referee-invitations/${token}/accept`,
      body,
      { headers, validateStatus: () => true }
    );
    if (res.status !== 200 && res.status !== 201) {
      throw new HttpException(res.data, res.status);
    }
    return res.data;
  }

  async proxyJoinTournament(token: string, authHeader?: string) {
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers['authorization'] = authHeader;
    }
    const res = await axios.post(
      `${this.authServiceUrl}/api/referee-invitations/${token}/join`,
      {},
      { headers, validateStatus: () => true }
    );
    if (res.status !== 200 && res.status !== 201) {
      throw new HttpException(res.data, res.status);
    }
    return res.data;
  }
}

