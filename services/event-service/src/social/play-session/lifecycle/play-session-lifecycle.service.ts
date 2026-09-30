import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  PlaySessionParticipantStatus,
  PlaySessionStatus,
  SocialParticipantStatus,
  SocialStatus,
} from "@prisma/client";
import { PrismaService } from "../../../prisma.service";
import { SocialParticipantService } from "../../participant/social-participant.service";
import { SocialService } from "../../social.service";

@Injectable()
export class PlaySessionLifecycleService {
  private readonly logger = new Logger(PlaySessionLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly socialParticipantService: SocialParticipantService,
    private readonly socialService: SocialService,
  ) { }

  // #region Start

  /**
   * Transition an ACTIVE play session to IN_PROGRESS and seed
   * `PlaySessionParticipant` rows from the parent social's CONFIRMED
   * `SocialParticipant`s. Idempotent via `skipDuplicates` so a re-run of a
   * partially-completed seed (e.g. previous attempt crashed mid-write) won't
   * 500 on the unique `[playSessionId, userId]` constraint.
   */
  async start(socialId: string, sessionId: string, callerId: string) {
    await this.requireCreator(socialId, callerId);

    const session = await this.prisma.playSession.findFirst({
      where: { id: sessionId, socialId },
      select: { id: true, status: true },
    });
    if (!session) {
      throw new NotFoundException("Play session not found");
    }
    if (session.status !== PlaySessionStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot start a play session in ${session.status} status (must be ACTIVE)`
      );
    }

    // Pull CONFIRMED participants of the parent social — these get seeded
    // as the initial roster for the play session itself.
    const confirmedRoster = await this.prisma.socialParticipant.findMany({
      where: { socialId, status: SocialParticipantStatus.CONFIRMED },
      select: { userId: true },
    });

    const seedRows = confirmedRoster.map((p) => ({
      playSessionId: sessionId,
      userId: p.userId,
      status: PlaySessionParticipantStatus.CONFIRMED,
    }));

    const result = await this.prisma.$transaction(async (tx) => {
      const inserted = await tx.playSessionParticipant.createMany({
        data: seedRows,
        skipDuplicates: true,
      });

      const updated = await tx.playSession.update({
        where: { id: sessionId },
        data: { status: PlaySessionStatus.IN_PROGRESS },
      });

      // Recalculate fees for all active participants who are NOT full package
      const nonFullPackageParts = await tx.socialParticipant.findMany({
        where: { socialId, isFullPackage: false, status: { not: SocialParticipantStatus.CANCELLED } },
        select: { id: true }
      });
      for (const part of nonFullPackageParts) {
        await this.socialParticipantService.recalculateParticipantTotalFee(tx, part.id);
      }

      return { session: updated, seededParticipants: inserted.count };
    });

    this.logger.log(
      `Play session ${sessionId} started by ${callerId}; seeded ${result.seededParticipants} participant rows`
    );

    return {
      message: "Play session started",
      data: result,
    };
  }

  // #endregion

  // #region Complete

  /**
   * Transition an IN_PROGRESS play session to COMPLETED. If every sibling
   * session of the parent social is now in `{COMPLETED, CANCELLED}`, also
   * mark the social itself COMPLETED. Cascade is skipped if the parent
   * social is already in a terminal state.
   */
  async complete(socialId: string, sessionId: string, callerId: string) {
    await this.requireCreator(socialId, callerId);

    const session = await this.prisma.playSession.findFirst({
      where: { id: sessionId, socialId },
      select: { id: true, status: true },
    });
    if (!session) {
      throw new NotFoundException("Play session not found");
    }
    if (session.status !== PlaySessionStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot complete a play session in ${session.status} status (must be IN_PROGRESS)`
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.playSession.update({
        where: { id: sessionId },
        data: { status: PlaySessionStatus.COMPLETED },
      });

      // Cascade: if no sibling session is still in flight, finish the social.
      const stillRunning = await tx.playSession.count({
        where: {
          socialId,
          id: { not: sessionId },
          status: {
            notIn: [PlaySessionStatus.COMPLETED, PlaySessionStatus.CANCELLED],
          },
        },
      });

      let socialCascaded = false;
      if (stillRunning === 0) {
        const social = await tx.social.findUnique({
          where: { id: socialId },
          select: { status: true },
        });
        if (
          social &&
          social.status !== SocialStatus.COMPLETED &&
          social.status !== SocialStatus.CANCELLED
        ) {
          await tx.social.update({
            where: { id: socialId },
            data: { status: SocialStatus.COMPLETED },
          });
          socialCascaded = true;
        }
      }

      return { session: updated, socialCascadedToCompleted: socialCascaded };
    });

    this.logger.log(
      `Play session ${sessionId} completed by ${callerId}; socialCascaded=${result.socialCascadedToCompleted}`
    );

    if (result.socialCascadedToCompleted) {
      try {
        await this.socialService.compileSocialStats(socialId);
      } catch (statsError) {
        this.logger.error(
          `Failed to compile social statistics for cascaded completed social ${socialId}: ${
            statsError instanceof Error ? statsError.message : String(statsError)
          }`
        );
      }
    }

    return {
      message: "Play session completed",
      data: result,
    };
  }

  // #endregion

  // #region Private helpers

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
      throw new BadRequestException("Cannot perform action on a completed or cancelled social");
    }
  }

  // #endregion
}
