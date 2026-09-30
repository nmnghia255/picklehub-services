import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, SocialParticipantStatus, SocialStatus, SocialPaymentStatus, SocialTransactionType, ParticipantPaymentStatus, PlaySessionStatus, PlaySessionParticipantStatus } from "@prisma/client";
import axios, { AxiosInstance } from "axios";
import { NotificationService } from "../../notification/notification.service";
import { PrismaService } from "../../prisma.service";
import {
  SOCIAL_WAITLIST_PROMOTED_EVENT,
  type SocialWaitlistPromotedEvent,
} from "../social.events";
import {
  ListSocialParticipantsQueryDto,
  ListSocialParticipantsStatusFilter,
} from "./dto/list-social-participants.query.dto";
import { UpdateSocialParticipantStatusDto } from "./dto/update-social-participant-status.dto";
import { PaySocialDto } from "./dto/pay-social.dto";
import { VerifySocialPaymentDto } from "./dto/verify-payment.dto";
import { RefundSocialPaymentDto } from "./dto/refund-payment.dto";
import { UserService } from "../../user/user.service";
import { JoinSocialDto } from "./dto/join-social.dto";
import { ChatClient } from "../../clients/chat.client";

@Injectable()
export class SocialParticipantService {
  private readonly logger = new Logger(SocialParticipantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
    private readonly chatClient: ChatClient,
  ) { }

  // #region List

  // Fire-and-forget helper: fetch all CONFIRMED social participants and sync to chat-service
  private syncSocialChat(socialId: string): void {
    this.prisma.social
      .findUnique({
        where: { id: socialId },
        select: {
          creatorId: true,
          participants: {
            where: {
              status: SocialParticipantStatus.CONFIRMED,
            },
            select: { userId: true },
          },
        },
      })
      .then((social) => {
        const memberIds = new Set<string>();
        if (social?.creatorId) memberIds.add(social.creatorId);
        for (const participant of social?.participants ?? []) {
          if (participant.userId) memberIds.add(participant.userId);
        }

        this.chatClient.syncSocialChat(
          socialId,
          Array.from(memberIds),
        );
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to fetch members for social chat sync socialId=${socialId}: ${(error as Error)?.message ?? error}`,
        );
      });
  }

  async list(socialId: string, query: ListSocialParticipantsQueryDto) {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: { id: true },
    });

    if (!social) {
      throw new NotFoundException("Social not found");
    }

    const where: Prisma.SocialParticipantWhereInput = { socialId };
    if (
      query.status &&
      query.status !== ListSocialParticipantsStatusFilter.ALL
    ) {
      where.status = query.status as unknown as SocialParticipantStatus;
    }

    const participants = await this.prisma.socialParticipant.findMany({
      where,
      orderBy: { joinedAt: "desc" },
      include: {
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    const userIds = participants.map((p) => p.userId).filter((id): id is string => Boolean(id));
    const users = userIds.length > 0 ? await this.userService.getManyUsersByIds(userIds) : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enrichedParticipants = participants.map((p) => ({
      ...p,
      amountDue: Math.max(0, p.totalFee - (p.amountPaid - p.amountRefunded)),
      amountOverpaid: Math.max(0, (p.amountPaid - p.amountRefunded) - p.totalFee),
      user: userMap.get(p.userId) || null,
      paymentUrl: p.payments[0]?.receiptUrl ?? null,
    }));

    return {
      message: "Social participants fetched",
      data: enrichedParticipants,
    };
  }

  // #endregion

  // #region Join

  async join(socialId: string, userId: string, dto?: JoinSocialDto) {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: {
        id: true,
        status: true,
        joinedCount: true,
        autoApproveJoinRequests: true,
      },
    });

    if (!social) {
      throw new NotFoundException("Social not found");
    }

    if (social.status !== SocialStatus.PUBLISHED) {
      throw new BadRequestException(
        "Social is not open for joining (must be PUBLISHED)"
      );
    }

    const wantsSlot = social.autoApproveJoinRequests;
    const isFullPackage = dto?.isFullPackage ?? true;

    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        // A user who previously left or got kicked has a CANCELLED row in
        // place. The unique [socialId, userId] constraint stops us from
        // INSERTing a fresh one, so reactivate the cancelled row instead.
        // A row in any other status means they're still an active member,
        // 409 stays.
        const existing = await tx.socialParticipant.findUnique({
          where: { socialId_userId: { socialId, userId } },
        });
        if (existing && existing.status !== SocialParticipantStatus.CANCELLED) {
          throw new ConflictException(
            "You are already a participant of this social"
          );
        }

        let participantStatus: SocialParticipantStatus;

        if (!wantsSlot) {
          participantStatus = SocialParticipantStatus.ON_HOLD;
        } else {
          participantStatus = SocialParticipantStatus.CONFIRMED;
        }

        const row = existing
          ? await tx.socialParticipant.update({
            where: { id: existing.id },
            // Reset joinedAt so a rejoiner doesn't unfairly land at the
            // head of the waitlist based on their original join time.
            data: {
              status: participantStatus,
              joinedAt: new Date(),
              paymentStatus: "UNPAID",
              isFullPackage,
            },
          })
          : await tx.socialParticipant.create({
            data: {
              socialId,
              userId,
              status: participantStatus,
              paymentStatus: "UNPAID",
              isHost: false,
              isFullPackage,
            },
          });

        await this.refreshHasAvailableSlots(tx, socialId);

        await this.recalculateParticipantTotalFee(tx, row.id);

        const finalRow = await tx.socialParticipant.findUnique({
          where: { id: row.id },
        });

        return finalRow!;
      });

    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "You are already a participant of this social"
        );
      }
      throw error;
    }

    // Sync chat if participant is now CONFIRMED (after try/catch so errors don't swallow original)
    if (result.status === SocialParticipantStatus.CONFIRMED) {
      this.syncSocialChat(socialId);
    }

    return {
      message: "Joined social successfully",
      data: {
        ...result,
        amountDue: Math.max(0, result.totalFee - (result.amountPaid - result.amountRefunded)),
        amountOverpaid: Math.max(0, (result.amountPaid - result.amountRefunded) - result.totalFee),
        paymentUrl: null,
      },
    };
  }

  async leaveAsMe(socialId: string, userId: string) {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: { status: true },
    });
    if (!social) {
      throw new NotFoundException("Social not found");
    }
    if (social.status === SocialStatus.COMPLETED || social.status === SocialStatus.CANCELLED) {
      throw new BadRequestException("Cannot leave a completed or cancelled social");
    }

    const participant = await this.prisma.socialParticipant.findUnique({
      where: { socialId_userId: { socialId, userId } },
    });

    if (!participant) {
      throw new NotFoundException("You are not a participant of this social");
    }

    if (participant.isHost) {
      throw new BadRequestException(
        "Host cannot leave their own social. Delete or cancel it instead."
      );
    }

    if (participant.status === SocialParticipantStatus.CANCELLED) {
      throw new BadRequestException("You have already left this social");
    }

    const wasConfirmed =
      participant.status === SocialParticipantStatus.CONFIRMED;

    const promotedUserId = await this.prisma.$transaction(async (tx) => {
      await tx.socialParticipant.update({
        where: { id: participant.id },
        data: { status: SocialParticipantStatus.CANCELLED },
      });

      await this.recalculateParticipantTotalFee(tx, participant.id);

      let promoted: string | null = null;
      if (wasConfirmed) {
        await tx.social.update({
          where: { id: socialId },
          data: { joinedCount: { decrement: 1 } },
        });

        promoted = await this.promoteHeadOfWaitlist(tx, socialId);
        if (promoted) {
          const promotedPart = await tx.socialParticipant.findUnique({
            where: { socialId_userId: { socialId, userId: promoted } },
            select: { id: true },
          });
          if (promotedPart) {
            await this.recalculateParticipantTotalFee(tx, promotedPart.id);
          }
        }
      }
      await this.refreshHasAvailableSlots(tx, socialId);
      return promoted;
    });

    this.emitPromotedIfAny(socialId, promotedUserId);

    // Sync chat after user left (remove from participants)
    this.syncSocialChat(socialId);

    return {
      message: "Left social successfully",
      data: { socialId, userId, promotedUserId },
    };
  }

  // #endregion

  // #region Organizer — approve

  async approve(socialId: string, participantId: string, callerId: string) {
    await this.requireCreator(socialId, callerId);

    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: { id: true },
    });
    if (!social) {
      throw new NotFoundException("Social not found");
    }

    const participant = await this.prisma.socialParticipant.findFirst({
      where: { id: participantId, socialId },
    });
    if (!participant) {
      throw new NotFoundException("Participant not found in this social");
    }

    if (
      participant.status !== SocialParticipantStatus.WAITLISTED &&
      participant.status !== SocialParticipantStatus.ON_HOLD
    ) {
      throw new BadRequestException(
        `Can only approve WAITLISTED or ON_HOLD participants (got ${participant.status})`
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.socialParticipant.update({
        where: { id: participantId },
        data: { status: SocialParticipantStatus.CONFIRMED },
      });

      // Sync play session participant status to CONFIRMED
      const sessions = await tx.playSession.findMany({
        where: { socialId },
        select: { id: true },
      });
      const sessionIds = sessions.map(s => s.id);
      if (sessionIds.length > 0) {
        await tx.playSessionParticipant.updateMany({
          where: {
            playSessionId: { in: sessionIds },
            userId: row.userId,
            status: { not: PlaySessionParticipantStatus.CANCELLED },
          },
          data: {
            status: PlaySessionParticipantStatus.CONFIRMED,
          },
        });
      }

      await this.recalculateParticipantTotalFee(tx, participantId);

      const finalRow = await tx.socialParticipant.findUnique({
        where: { id: participantId },
      });

      await this.refreshHasAvailableSlots(tx, socialId);
      return finalRow!;
    });

    // Sync chat after approval (participant is now CONFIRMED)
    this.syncSocialChat(socialId);

    return {
      message: "Participant approved",
      data: updated,
    };
  }

  // #endregion

  // #region Organizer — manual status override

  async updateStatus(
    socialId: string,
    participantId: string,
    callerId: string,
    dto: UpdateSocialParticipantStatusDto
  ) {
    await this.requireCreator(socialId, callerId);

    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: { id: true },
    });
    if (!social) {
      throw new NotFoundException("Social not found");
    }

    const participant = await this.prisma.socialParticipant.findFirst({
      where: { id: participantId, socialId },
    });
    if (!participant) {
      throw new NotFoundException("Participant not found in this social");
    }

    if (participant.isHost) {
      throw new BadRequestException(
        "Cannot change the host participant status via this endpoint"
      );
    }

    const oldStatus = participant.status;
    const newStatus = dto.status;

    if (oldStatus === newStatus) {
      return {
        message: "No status change",
        data: participant,
      };
    }

    const wasConfirmed = oldStatus === SocialParticipantStatus.CONFIRMED;
    const willBeConfirmed = newStatus === SocialParticipantStatus.CONFIRMED;

    const result = await this.prisma.$transaction(async (tx) => {
      // Case: stepping INTO CONFIRMED — no capacity check needed.

      // Case: stepping OUT of CONFIRMED — free a slot.
      let promoted: string | null = null;
      if (wasConfirmed && !willBeConfirmed) {
        await tx.social.update({
          where: { id: socialId },
          data: { joinedCount: { decrement: 1 } },
        });
        promoted = await this.promoteHeadOfWaitlist(tx, socialId);
        if (promoted) {
          const promotedPart = await tx.socialParticipant.findUnique({
            where: { socialId_userId: { socialId, userId: promoted } },
            select: { id: true },
          });
          if (promotedPart) {
            await this.recalculateParticipantTotalFee(tx, promotedPart.id);
          }
        }
      }

      const row = await tx.socialParticipant.update({
        where: { id: participantId },
        data: { status: newStatus },
      });

      // Sync play session participant status
      let playStatus: PlaySessionParticipantStatus;
      if (newStatus === SocialParticipantStatus.CONFIRMED) {
        playStatus = PlaySessionParticipantStatus.CONFIRMED;
      } else if (newStatus === SocialParticipantStatus.CANCELLED) {
        playStatus = PlaySessionParticipantStatus.CANCELLED;
      } else if (newStatus === SocialParticipantStatus.ON_HOLD) {
        playStatus = PlaySessionParticipantStatus.ON_HOLD;
      } else {
        playStatus = PlaySessionParticipantStatus.WAITLISTED;
      }

      const sessions = await tx.playSession.findMany({
        where: { socialId },
        select: { id: true },
      });
      const sessionIds = sessions.map(s => s.id);
      if (sessionIds.length > 0) {
        await tx.playSessionParticipant.updateMany({
          where: {
            playSessionId: { in: sessionIds },
            userId: row.userId,
            status: { not: PlaySessionParticipantStatus.CANCELLED },
          },
          data: {
            status: playStatus,
          },
        });
      }

      await this.recalculateParticipantTotalFee(tx, participantId);

      const finalRow = await tx.socialParticipant.findUnique({
        where: { id: participantId },
      });

      await this.refreshHasAvailableSlots(tx, socialId);

      return { row: finalRow!, promoted };
    });

    this.emitPromotedIfAny(socialId, result.promoted);

    // Sync chat whenever CONFIRMED status boundary is crossed
    const confirmedBoundaryCrossed =
      wasConfirmed !== willBeConfirmed;
    if (confirmedBoundaryCrossed) {
      this.syncSocialChat(socialId);
    }

    return {
      message: "Participant status updated",
      data: { ...result.row, promotedUserId: result.promoted },
    };
  }

  // #endregion

  // #region Organizer — kick

  async kick(
    socialId: string,
    participantId: string,
    callerId: string,
    callerLabel: string
  ) {
    await this.requireCreator(socialId, callerId);

    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: { id: true, title: true },
    });
    if (!social) {
      throw new NotFoundException("Social not found");
    }

    const participant = await this.prisma.socialParticipant.findFirst({
      where: { id: participantId, socialId },
    });
    if (!participant) {
      throw new NotFoundException("Participant not found in this social");
    }

    if (participant.isHost) {
      throw new BadRequestException("Cannot kick the host");
    }

    if (participant.status === SocialParticipantStatus.CANCELLED) {
      throw new BadRequestException("Participant is already cancelled");
    }

    const wasConfirmed =
      participant.status === SocialParticipantStatus.CONFIRMED;

    const promotedUserId = await this.prisma.$transaction(async (tx) => {
      // 1. Kick/Cancel play session participants first
      const sessions = await tx.playSession.findMany({
        where: { socialId },
        select: { id: true },
      });
      const sessionIds = sessions.map(s => s.id);
      if (sessionIds.length > 0 && participant.userId) {
        await tx.playSessionParticipant.updateMany({
          where: {
            playSessionId: { in: sessionIds },
            userId: participant.userId,
            status: { not: PlaySessionParticipantStatus.CANCELLED },
          },
          data: {
            status: PlaySessionParticipantStatus.CANCELLED,
          },
        });
      }

      // 2. Cancel social participant status
      await tx.socialParticipant.update({
        where: { id: participantId },
        data: { status: SocialParticipantStatus.CANCELLED },
      });

      // 3. Recalculate participant total fee (will set to 0 since cancelled)
      await this.recalculateParticipantTotalFee(tx, participantId);

      // 4. Auto-refund if they have paid
      const freshPart = await tx.socialParticipant.findUnique({
        where: { id: participantId },
        select: { amountPaid: true, amountRefunded: true },
      });
      const netPaid = (freshPart?.amountPaid ?? 0) - (freshPart?.amountRefunded ?? 0);
      if (netPaid > 0) {
        await tx.socialPayment.create({
          data: {
            socialParticipantId: participantId,
            amount: -netPaid,
            status: SocialPaymentStatus.CONFIRMED,
            transactionType: SocialTransactionType.REFUND,
            createdById: callerId,
            verifiedById: callerId,
          },
        });

        await tx.socialParticipant.update({
          where: { id: participantId },
          data: {
            amountRefunded: { increment: netPaid },
          },
        });

        // Recalculate payment status again after refund
        await this.recalculatePaymentStatus(tx, participantId);
      }

      // 5. Decrement joinedCount and promote waitlist
      let promoted: string | null = null;
      if (wasConfirmed) {
        await tx.social.update({
          where: { id: socialId },
          data: { joinedCount: { decrement: 1 } },
        });

        promoted = await this.promoteHeadOfWaitlist(tx, socialId);
        if (promoted) {
          const promotedPart = await tx.socialParticipant.findUnique({
            where: { socialId_userId: { socialId, userId: promoted } },
            select: { id: true },
          });
          if (promotedPart) {
            await this.recalculateParticipantTotalFee(tx, promotedPart.id);
          }
        }
      }
      await this.refreshHasAvailableSlots(tx, socialId);
      return promoted;
    });

    this.emitPromotedIfAny(socialId, promotedUserId);

    // Sync chat after participant is kicked
    this.syncSocialChat(socialId);

    // Best-effort kick notification — don't fail the request if the
    // notification service is unreachable. Guests (userId=null) get skipped.
    if (participant.userId) {
      this.notificationService
        .sendInAppNotification(
          [participant.userId],
          "Removed from social",
          `${callerLabel} removed you from "${social.title}".`
        )
        .catch((error) => {
          this.logger.warn(
            `Failed to deliver kick notification to ${participant.userId}: ${error?.message ?? error}`
          );
        });
    }

    return {
      message: "Participant removed",
      data: {
        socialId,
        participantId,
        promotedUserId,
      },
    };
  }

  // #endregion

  // Helper to recalculate paymentStatus on SocialParticipant based on its payments
  private async recalculatePaymentStatus(tx: Prisma.TransactionClient, socialParticipantId: string) {
    const participant = await tx.socialParticipant.findUnique({
      where: { id: socialParticipantId },
      select: { totalFee: true, amountPaid: true, amountRefunded: true },
    });
    if (!participant) return;

    const netPaid = participant.amountPaid - participant.amountRefunded;

    let newStatus: ParticipantPaymentStatus;
    if (participant.totalFee === 0) {
      if (netPaid > 0) {
        newStatus = ParticipantPaymentStatus.OVERPAID;
      } else if (netPaid < 0) {
        newStatus = ParticipantPaymentStatus.REFUNDED;
      } else {
        const hasTransactions = await tx.socialPayment.count({
          where: { socialParticipantId },
        });
        newStatus = hasTransactions > 0 ? ParticipantPaymentStatus.REFUNDED : ParticipantPaymentStatus.PAID;
      }
    } else {
      if (netPaid <= 0) {
        newStatus = ParticipantPaymentStatus.UNPAID;
      } else if (netPaid < participant.totalFee) {
        newStatus = ParticipantPaymentStatus.PARTIALLY_PAID;
      } else if (netPaid === participant.totalFee) {
        newStatus = ParticipantPaymentStatus.PAID;
      } else {
        newStatus = ParticipantPaymentStatus.OVERPAID;
      }
    }

    await tx.socialParticipant.update({
      where: { id: socialParticipantId },
      data: { paymentStatus: newStatus },
    });
  }

  /**
   * Submit a payment for the currently logged in participant
   */
  async pay(socialId: string, userId: string, dto: PaySocialDto) {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: { status: true },
    });
    if (!social) {
      throw new NotFoundException("Social not found");
    }
    if (social.status === SocialStatus.COMPLETED || social.status === SocialStatus.CANCELLED) {
      throw new BadRequestException("Cannot submit payment for a completed or cancelled social");
    }

    const participant = await this.prisma.socialParticipant.findUnique({
      where: { socialId_userId: { socialId, userId } },
    });
    if (!participant) {
      throw new NotFoundException("You are not a participant of this social");
    }
    if (participant.status === SocialParticipantStatus.CANCELLED) {
      throw new BadRequestException("Cannot submit payment for a cancelled participation");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.socialPayment.create({
        data: {
          socialParticipantId: participant.id,
          amount: dto.amount,
          receiptUrl: dto.receiptUrl,
          status: SocialPaymentStatus.PENDING_REVIEW,
          transactionType: SocialTransactionType.PAYMENT,
          createdById: userId,
        },
      });

      await this.recalculatePaymentStatus(tx, participant.id);
      return payment;
    });

    return {
      message: "Payment submitted successfully, waiting for verification",
      data: result,
    };
  }

  /**
   * Host verifies a specific payment transaction
   */
  async verify(socialId: string, participantId: string, callerId: string, dto: VerifySocialPaymentDto) {
    await this.requireCreator(socialId, callerId);

    const participant = await this.prisma.socialParticipant.findFirst({
      where: { id: participantId, socialId },
    });
    if (!participant) {
      throw new NotFoundException("Participant not found in this social");
    }

    const payment = await this.prisma.socialPayment.findFirst({
      where: { id: dto.paymentId, socialParticipantId: participantId },
    });
    if (!payment) {
      throw new NotFoundException("Payment transaction not found");
    }
    if (payment.status !== SocialPaymentStatus.PENDING_REVIEW) {
      throw new ConflictException("Payment is already verified or rejected");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const actualAmount = dto.status === SocialPaymentStatus.CONFIRMED && dto.amountPaid !== undefined
        ? dto.amountPaid
        : payment.amount;

      // update payment status and actual verified amount
      const updatedPayment = await tx.socialPayment.update({
        where: { id: dto.paymentId },
        data: {
          status: dto.status,
          verifiedById: callerId,
          amount: actualAmount,
        },
      });

      if (dto.status === SocialPaymentStatus.CONFIRMED) {
        // Host approved: increment amountPaid
        await tx.socialParticipant.update({
          where: { id: participantId },
          data: {
            amountPaid: { increment: actualAmount },
          },
        });
      }

      await this.recalculatePaymentStatus(tx, participantId);
      return updatedPayment;
    });

    return {
      message: `Payment transaction verified successfully as ${dto.status}`,
      data: result,
    };
  }

  /**
   * Host refunds money / handles surplus for a participant
   */
  async refund(socialId: string, participantId: string, callerId: string, dto: RefundSocialPaymentDto) {
    await this.requireCreator(socialId, callerId);

    const participant = await this.prisma.socialParticipant.findFirst({
      where: { id: participantId, socialId },
    });
    if (!participant) {
      throw new NotFoundException("Participant not found in this social");
    }

    const creditBalance = participant.amountPaid - participant.amountRefunded - participant.totalFee;
    if (dto.amount > creditBalance) {
      throw new BadRequestException(`Refund amount cannot exceed credit balance (${creditBalance})`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Create negative payment entry
      const payment = await tx.socialPayment.create({
        data: {
          socialParticipantId: participantId,
          amount: -dto.amount,
          status: SocialPaymentStatus.CONFIRMED,
          transactionType: SocialTransactionType.REFUND,
          createdById: callerId,
          verifiedById: callerId,
        },
      });

      // increment amountRefunded
      await tx.socialParticipant.update({
        where: { id: participantId },
        data: {
          amountRefunded: { increment: dto.amount },
        },
      });

      await this.recalculatePaymentStatus(tx, participantId);
      return payment;
    });

    return {
      message: "Refund processed successfully",
      data: result,
    };
  }

  /**
   * Host records a direct payment for a participant (e.g. cash or bank transfer received directly)
   */
  async recordDirectPayment(socialId: string, participantId: string, callerId: string, dto: PaySocialDto) {
    await this.requireCreator(socialId, callerId);

    const participant = await this.prisma.socialParticipant.findFirst({
      where: { id: participantId, socialId },
    });
    if (!participant) {
      throw new NotFoundException("Participant not found in this social");
    }
    if (participant.status === SocialParticipantStatus.CANCELLED) {
      throw new BadRequestException("Cannot record payment for a cancelled participation");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.socialPayment.create({
        data: {
          socialParticipantId: participantId,
          amount: dto.amount,
          receiptUrl: dto.receiptUrl,
          status: SocialPaymentStatus.CONFIRMED,
          transactionType: SocialTransactionType.PAYMENT,
          createdById: callerId,
          verifiedById: callerId,
        },
      });

      // Increment amountPaid immediately
      await tx.socialParticipant.update({
        where: { id: participantId },
        data: {
          amountPaid: { increment: dto.amount },
        },
      });

      await this.recalculatePaymentStatus(tx, participantId);
      return payment;
    });

    return {
      message: "Direct payment recorded successfully",
      data: result,
    };
  }

  // #region Private helpers

  async recalculateParticipantTotalFee(
    tx: Prisma.TransactionClient,
    participantId: string,
  ): Promise<void> {
    const participant = await tx.socialParticipant.findUnique({
      where: { id: participantId },
      select: { id: true, socialId: true, userId: true, isFullPackage: true, status: true, isHost: true },
    });
    if (!participant) return;

    let totalFee = 0;

    if (participant.isHost) {
      totalFee = 0;
    } else if (participant.status === SocialParticipantStatus.CANCELLED) {
      totalFee = 0;
    } else if (participant.isFullPackage) {
      const social = await tx.social.findUnique({
        where: { id: participant.socialId },
        select: { packageFee: true },
      });
      totalFee = social?.packageFee ?? 0;
    } else {
      const sessions = await tx.playSession.findMany({
        where: {
          socialId: participant.socialId,
          status: { not: PlaySessionStatus.CANCELLED },
          participants: {
            some: {
              userId: participant.userId,
              status: PlaySessionParticipantStatus.CONFIRMED,
            },
          },
        },
        select: { sessionFee: true },
      });
      totalFee = sessions.reduce((sum, s) => sum + (s.sessionFee ?? 0), 0);
    }

    await tx.socialParticipant.update({
      where: { id: participantId },
      data: { totalFee },
    });

    await this.recalculatePaymentStatus(tx, participantId);
  }

  /** 403s if the caller is not the creator of the social. */
  private async requireCreator(
    socialId: string,
    callerId: string
  ): Promise<void> {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: { creatorId: true, status: true },
    });
    if (!social) {
      throw new NotFoundException("Social not found");
    }
    if (social.creatorId !== callerId) {
      throw new ForbiddenException(
        "Only the creator of this social can perform this action"
      );
    }
    if (social.status === SocialStatus.COMPLETED || social.status === SocialStatus.CANCELLED) {
      throw new BadRequestException("Cannot modify details of a completed or cancelled social");
    }
  }

  /**
   * Promote the oldest WAITLISTED participant to CONFIRMED (and increment
   * `joinedCount`). Returns the promoted `userId`, or `null` if the waitlist
   * is empty or the head row is a guest (no `userId` to notify).
   *
   * Must run inside an active `$transaction`.
   */
  private async promoteHeadOfWaitlist(
    tx: Prisma.TransactionClient,
    socialId: string
  ): Promise<string | null> {
    const head = await tx.socialParticipant.findFirst({
      where: { socialId, status: SocialParticipantStatus.WAITLISTED },
      orderBy: { joinedAt: "asc" },
    });

    if (!head?.userId) return null;

    await tx.socialParticipant.update({
      where: { id: head.id },
      data: { status: SocialParticipantStatus.CONFIRMED },
    });
    await tx.social.update({
      where: { id: socialId },
      data: { joinedCount: { increment: 1 } },
    });

    return head.userId;
  }

  /** Recompute `joinedCount` and `hasAvailableSlots` from the live confirmed participants. */
  public async refreshHasAvailableSlots(
    tx: Prisma.TransactionClient,
    socialId: string
  ): Promise<void> {
    const playSessions = await tx.playSession.findMany({
      where: {
        socialId,
        status: { not: PlaySessionStatus.CANCELLED },
      },
      select: {
        id: true,
        numberOfCourts: true,
        participants: {
          where: {
            status: PlaySessionParticipantStatus.CONFIRMED,
          },
          select: {
            id: true,
          },
        },
      },
    });

    for (const session of playSessions) {
      await tx.playSession.update({
        where: { id: session.id },
        data: { joinedCount: session.participants.length },
      });
    }

    const hasAvailableSlots =
      playSessions.length === 0 ||
      playSessions.some((session) => session.participants.length < session.numberOfCourts * 4);

    const actualJoinedCount = await tx.socialParticipant.count({
      where: {
        socialId,
        status: SocialParticipantStatus.CONFIRMED,
      },
    });

    await tx.social.update({
      where: { id: socialId },
      data: {
        joinedCount: actualJoinedCount,
        hasAvailableSlots,
      },
    });
  }

  /**
   * Transactional method to cancel a user's social participation, recalculate fees, and promote waitlisted users.
   */
  public async cancelParticipantTx(
    tx: Prisma.TransactionClient,
    socialId: string,
    userId: string
  ): Promise<void> {
    const participant = await tx.socialParticipant.findUnique({
      where: { socialId_userId: { socialId, userId } },
    });
    if (!participant || participant.status === SocialParticipantStatus.CANCELLED || participant.isHost) {
      return;
    }
    const wasConfirmed = participant.status === SocialParticipantStatus.CONFIRMED;

    await tx.socialParticipant.update({
      where: { id: participant.id },
      data: { status: SocialParticipantStatus.CANCELLED },
    });

    await this.recalculateParticipantTotalFee(tx, participant.id);

    let promoted: string | null = null;
    if (wasConfirmed) {
      await tx.social.update({
        where: { id: socialId },
        data: { joinedCount: { decrement: 1 } },
      });

      promoted = await this.promoteHeadOfWaitlist(tx, socialId);
      if (promoted) {
        const promotedPart = await tx.socialParticipant.findUnique({
          where: { socialId_userId: { socialId, userId: promoted } },
          select: { id: true },
        });
        if (promotedPart) {
          await this.recalculateParticipantTotalFee(tx, promotedPart.id);
        }
      }
    }
    await this.refreshHasAvailableSlots(tx, socialId);

    if (promoted) {
      this.emitPromotedIfAny(socialId, promoted);
    }
  }

  /** Fire the existing `social.waitlist.promoted` event if a promotion happened. */
  private emitPromotedIfAny(socialId: string, promotedUserId: string | null) {
    if (!promotedUserId) return;
    this.eventEmitter.emit(SOCIAL_WAITLIST_PROMOTED_EVENT, {
      socialId,
      userId: promotedUserId,
    } satisfies SocialWaitlistPromotedEvent);
  }

  // #endregion
}
