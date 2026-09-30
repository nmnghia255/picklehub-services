import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  PlaySessionParticipantStatus,
  PlaySessionStatus,
  Prisma,
  SocialParticipantStatus,
} from '@prisma/client';
import { PrismaService } from '../../../prisma.service';
import { AddLiveGuestDto } from './dto/add-live-guest.dto';
import {
  ListPlaySessionParticipantsQueryDto,
  ListPlaySessionParticipantsStatusFilter,
} from './dto/list-play-session-participants.query.dto';
import { SocialParticipantService } from '../../participant/social-participant.service';
import { UserService } from '../../../user/user.service';

// Statuses where joining / leaving / adding guests is permitted.
const JOINABLE_SESSION_STATUSES: PlaySessionStatus[] = [
  PlaySessionStatus.ACTIVE,
  PlaySessionStatus.IN_PROGRESS,
];

@Injectable()
export class PlaySessionParticipantService {
  private readonly logger = new Logger(PlaySessionParticipantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socialParticipantService: SocialParticipantService,
    private readonly userService: UserService,
  ) { }

  // #region List

  async list(
    socialId: string,
    sessionId: string,
    query: ListPlaySessionParticipantsQueryDto,
  ) {
    await this.loadSessionOrFail(socialId, sessionId);

    const where: Prisma.PlaySessionParticipantWhereInput = {
      playSessionId: sessionId,
    };
    if (
      query.status &&
      query.status !== ListPlaySessionParticipantsStatusFilter.ALL
    ) {
      where.status = query.status as unknown as PlaySessionParticipantStatus;
    }

    const participants = await this.prisma.playSessionParticipant.findMany({
      where,
      orderBy: { joinedAt: 'desc' },
    });

    const hostUserId = await this.loadHostUserId(socialId);

    const userIds = participants.map((p) => p.userId).filter((id): id is string => Boolean(id));
    const users = userIds.length > 0 ? await this.userService.getManyUsersByIds(userIds) : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const socialParticipants = userIds.length > 0 ? await this.prisma.socialParticipant.findMany({
      where: {
        socialId,
        userId: { in: userIds },
      },
      include: {
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    }) : [];
    const socialPartMap = new Map(socialParticipants.map((sp) => [sp.userId, sp]));

    const decorated = this.decorateWithHost(participants, hostUserId);
    const data = decorated.map((p) => {
      const sp = p.userId ? socialPartMap.get(p.userId) : null;
      return {
        ...p,
        user: p.userId ? (userMap.get(p.userId) || null) : null,
        totalFee: sp ? sp.totalFee : 0,
        amountPaid: sp ? sp.amountPaid : 0,
        amountRefunded: sp ? sp.amountRefunded : 0,
        amountDue: sp ? Math.max(0, sp.totalFee - (sp.amountPaid - sp.amountRefunded)) : 0,
        amountOverpaid: sp ? Math.max(0, (sp.amountPaid - sp.amountRefunded) - sp.totalFee) : 0,
        paymentStatus: sp ? sp.paymentStatus : 'UNPAID',
        paymentUrl: sp?.payments?.[0]?.receiptUrl ?? null,
      };
    });

    return {
      message: 'Play session participants fetched',
      data,
    };
  }

  // #endregion

  // #region Self join

  async joinAsMe(socialId: string, sessionId: string, userId: string) {
    const session = await this.loadSessionOrFail(socialId, sessionId);
    this.assertJoinable(session.status, 'join');

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Load parent social to check autoApproveJoinRequests
        const social = await tx.social.findUnique({
          where: { id: socialId },
          select: { autoApproveJoinRequests: true },
        });
        if (!social) {
          throw new NotFoundException('Social not found');
        }

        const wantsSlot = social.autoApproveJoinRequests;
        const parentStatus = wantsSlot
          ? SocialParticipantStatus.CONFIRMED
          : SocialParticipantStatus.ON_HOLD;

        // Implicitly join the parent social
        const parentPart = await tx.socialParticipant.findUnique({
          where: { socialId_userId: { socialId, userId } },
          select: { id: true, isFullPackage: true, status: true },
        });

        let socialPartId: string;
        let isFullPackage = true;
        let finalParentStatus: SocialParticipantStatus = parentStatus;

        if (!parentPart) {
          const newSp = await tx.socialParticipant.create({
            data: {
              socialId,
              userId,
              status: parentStatus,
              paymentStatus: 'UNPAID',
              isHost: false,
              isFullPackage: true,
            },
          });
          socialPartId = newSp.id;
        } else {
          socialPartId = parentPart.id;
          isFullPackage = parentPart.isFullPackage;
          if (parentPart.status === SocialParticipantStatus.CANCELLED) {
            await tx.socialParticipant.update({
              where: { id: parentPart.id },
              data: {
                status: parentStatus,
                joinedAt: new Date(),
              },
            });
          } else {
            finalParentStatus = parentPart.status;
          }
        }

        // Determine PlaySessionParticipant status based on finalParentStatus
        let playSessionPartStatus: PlaySessionParticipantStatus;
        if (finalParentStatus === SocialParticipantStatus.CONFIRMED) {
          playSessionPartStatus = PlaySessionParticipantStatus.CONFIRMED;
        } else if (finalParentStatus === SocialParticipantStatus.ON_HOLD) {
          playSessionPartStatus = PlaySessionParticipantStatus.ON_HOLD;
        } else if (finalParentStatus === SocialParticipantStatus.WAITLISTED) {
          playSessionPartStatus = PlaySessionParticipantStatus.WAITLISTED;
        } else {
          playSessionPartStatus = PlaySessionParticipantStatus.CANCELLED;
        }

        const existing = await tx.playSessionParticipant.findUnique({
          where: { playSessionId_userId: { playSessionId: sessionId, userId } },
        });
        if (
          existing &&
          existing.status !== PlaySessionParticipantStatus.CANCELLED
        ) {
          throw new ConflictException(
            'You are already a participant of this play session',
          );
        }

        let row;
        if (existing) {
          row = await tx.playSessionParticipant.update({
            where: { id: existing.id },
            data: {
              status: playSessionPartStatus,
              joinedAt: new Date(),
            },
          });
        } else {
          row = await tx.playSessionParticipant.create({
            data: {
              playSessionId: sessionId,
              userId,
              status: playSessionPartStatus,
            },
          });
        }

        await this.socialParticipantService.refreshHasAvailableSlots(tx, socialId);

        if (!isFullPackage) {
          await this.socialParticipantService.recalculateParticipantTotalFee(tx, socialPartId);
        }

        return row;
      });

      const hostUserId = await this.loadHostUserId(socialId);
      return {
        message: 'Joined play session',
        data: this.decorateOneWithHost(result, hostUserId),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'You are already a participant of this play session',
        );
      }
      throw error;
    }
  }

  // #endregion

  // #region Self leave

  async leaveAsMe(socialId: string, sessionId: string, userId: string) {
    const session = await this.loadSessionOrFail(socialId, sessionId);
    this.assertJoinable(session.status, 'leave');

    const row = await this.prisma.playSessionParticipant.findUnique({
      where: { playSessionId_userId: { playSessionId: sessionId, userId } },
    });
    if (!row) {
      throw new NotFoundException(
        'You are not a participant of this play session',
      );
    }
    if (row.status === PlaySessionParticipantStatus.CANCELLED) {
      throw new BadRequestException(
        'You have already left this play session',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.playSessionParticipant.update({
        where: { id: row.id },
        data: { status: PlaySessionParticipantStatus.CANCELLED },
      });

      const activePlaySessionsCount = await tx.playSessionParticipant.count({
        where: {
          playSession: { socialId },
          userId,
          status: { not: PlaySessionParticipantStatus.CANCELLED },
        },
      });

      const parentPart = await tx.socialParticipant.findUnique({
        where: { socialId_userId: { socialId, userId } },
        select: { id: true, isFullPackage: true, status: true, isHost: true },
      });

      if (activePlaySessionsCount === 0 && parentPart && parentPart.status !== SocialParticipantStatus.CANCELLED && !parentPart.isHost) {
        await this.socialParticipantService.cancelParticipantTx(tx, socialId, userId);
      } else {
        await this.socialParticipantService.refreshHasAvailableSlots(tx, socialId);
        if (parentPart && !parentPart.isFullPackage) {
          await this.socialParticipantService.recalculateParticipantTotalFee(tx, parentPart.id);
        }
      }

      return res;
    });

    const hostUserId = await this.loadHostUserId(socialId);
    return {
      message: 'Left play session',
      data: this.decorateOneWithHost(updated, hostUserId),
    };
  }

  // #endregion

  // #region Live guest add

  // async addLiveGuest(
  //   socialId: string,
  //   sessionId: string,
  //   callerId: string,
  //   dto: AddLiveGuestDto,
  // ) {
  //   await this.requireOrganizer(socialId, callerId);
  //   const session = await this.loadSessionOrFail(socialId, sessionId);
  //   this.assertJoinable(session.status, 'add a guest');

  //   const created = await this.prisma.playSessionParticipant.create({
  //     data: {
  //       playSessionId: sessionId,
  //       userId: null,
  //       isGuest: true,
  //       guestName: dto.guestName,
  //       skillLevel:
  //         dto.skillLevel !== undefined
  //           ? new Prisma.Decimal(dto.skillLevel)
  //           : undefined,
  //       status: PlaySessionParticipantStatus.CONFIRMED,
  //     },
  //   });

  //   this.logger.log(
  //     `Live guest ${created.id} (${dto.guestName}) added to play session ${sessionId} by ${callerId}`,
  //   );

  //   // Guests always have userId=null → isHost=false; the decorator just keeps
  //   // the response shape uniform with the other endpoints.
  //   const hostUserId = await this.loadHostUserId(socialId);
  //   return {
  //     message: 'Live guest added',
  //     data: this.decorateOneWithHost(created, hostUserId),
  //   };
  // }

  // #endregion

  // #region Live guest remove

  // async removeLiveGuest(
  //   socialId: string,
  //   sessionId: string,
  //   participantId: string,
  //   callerId: string,
  // ) {
  //   await this.requireOrganizer(socialId, callerId);
  //   const session = await this.loadSessionOrFail(socialId, sessionId);
  //   this.assertJoinable(session.status, 'remove a guest');

  //   const row = await this.prisma.playSessionParticipant.findFirst({
  //     where: { id: participantId, playSessionId: sessionId },
  //   });
  //   if (!row) {
  //     throw new NotFoundException('Participant not found in this play session');
  //   }
  //   if (!row.isGuest) {
  //     throw new BadRequestException(
  //       'Target is a real user, not a live guest. Use the self-leave endpoint or kick at the social level.',
  //     );
  //   }
  //   if (row.status === PlaySessionParticipantStatus.CANCELLED) {
  //     throw new BadRequestException(
  //       'Live guest is already cancelled',
  //     );
  //   }

  //   const updated = await this.prisma.playSessionParticipant.update({
  //     where: { id: row.id },
  //     data: { status: PlaySessionParticipantStatus.CANCELLED },
  //   });

  //   const hostUserId = await this.loadHostUserId(socialId);
  //   return {
  //     message: 'Live guest removed',
  //     data: this.decorateOneWithHost(updated, hostUserId),
  //   };
  // }

  // #endregion

  // #region Private helpers

  private async loadSessionOrFail(socialId: string, sessionId: string) {
    const session = await this.prisma.playSession.findFirst({
      where: { id: sessionId, socialId },
      select: { id: true, status: true },
    });
    if (!session) {
      throw new NotFoundException('Play session not found');
    }
    return session;
  }

  /**
   * Resolve the userId of the social's host (`SocialParticipant.isHost=true`).
   * Returns `null` when the social was created with `hostRole=HOST_ONLY` and
   * therefore has no host SocialParticipant row.
   */
  private async loadHostUserId(socialId: string): Promise<string | null> {
    const host = await this.prisma.socialParticipant.findFirst({
      where: { socialId, isHost: true },
      select: { userId: true },
    });
    return host?.userId ?? null;
  }

  /**
   * Annotate PSP rows with a computed `isHost` flag derived from the social's
   * `SocialParticipant.isHost`. PSP itself has no `isHost` column, so this
   * keeps clients from needing a second round-trip to figure out which row
   * is the host. Live guests (`userId=null`) always get `isHost: false`.
   */
  private decorateWithHost<T extends { userId: string | null }>(
    rows: T[],
    hostUserId: string | null,
  ): Array<T & { isHost: boolean }> {
    return rows.map((row) => ({
      ...row,
      isHost: !!hostUserId && row.userId === hostUserId,
    }));
  }

  private decorateOneWithHost<T extends { userId: string | null }>(
    row: T,
    hostUserId: string | null,
  ): T & { isHost: boolean } {
    return {
      ...row,
      isHost: !!hostUserId && row.userId === hostUserId,
    };
  }

  private assertJoinable(status: PlaySessionStatus, verb: string): void {
    if (!JOINABLE_SESSION_STATUSES.includes(status)) {
      throw new BadRequestException(
        `Cannot ${verb} a play session in ${status} status (must be ACTIVE or IN_PROGRESS).`,
      );
    }
  }

  private async requireCreator(
    socialId: string,
    callerId: string,
  ): Promise<void> {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: { creatorId: true },
    });
    if (!social) {
      throw new NotFoundException('Social not found');
    }
    if (social.creatorId !== callerId) {
      throw new ForbiddenException(
        'Only the creator of this social can perform this action',
      );
    }
  }

  // #endregion
}
