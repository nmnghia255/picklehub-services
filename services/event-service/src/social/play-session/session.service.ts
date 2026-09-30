import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from '../../prisma.service';
import { CreateSessionDto } from "./dto/create-session.dto";
import { SocialParticipantService } from '../participant/social-participant.service';
import { UpdateSessionDto } from "./dto/update-session.dto";
import { UserService } from '../../user/user.service';
import {
  PlaySessionParticipantStatus,
  PlaySessionStatus,
  SocialParticipantStatus,
  SocialStatus,
} from "@prisma/client";

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly notificationAxios: AxiosInstance;
  private readonly centerAxios: AxiosInstance;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly socialParticipantService: SocialParticipantService,
    private readonly userService: UserService,
  ) {
    // Init axios to call Notification Service internal api
    const NotificationServiceUrl = this.configService.get<string>('NOTIFICATION_SERVICE_URL');
    const notificationToken = this.configService.get<string>('SERVICE_INTERNAL_TOKEN');

    this.notificationAxios = axios.create({
      baseURL: NotificationServiceUrl,
      headers: {
        'X-Internal-Service-Token': notificationToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 seconds timeout
    });

    // Init axios to call Center Service internal api
    const CenterServiceUrl = this.configService.get<string>('SPORT_CENTER_SERVICE_URL');
    const centerToken = this.configService.get<string>('SERVICE_INTERNAL_TOKEN');

    this.centerAxios = axios.create({
      baseURL: CenterServiceUrl,
      headers: {
        'X-Internal-Service-Token': centerToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 seconds timeout
    });
  }

  private buildCourtSummary(bookingInfos: any[]) {
    const courtMap = new Map<string, string>();
    const items: Array<{
      courtId: string;
      courtName: string;
      startMs: number;
      endMs: number;
    }> = [];

    for (const booking of bookingInfos) {
      const dateValue = booking?.date;
      const datePart =
        typeof dateValue === 'string'
          ? dateValue.slice(0, 10)
          : dateValue instanceof Date
            ? dateValue.toISOString().slice(0, 10)
            : null;

      for (const item of booking?.bookingItems ?? []) {
        const courtId = item?.court?.id;
        const courtName = item?.court?.name;
        if (!courtId || !courtName || !datePart) continue;

        const startMs = Date.parse(`${datePart}T${item.startTime}:00+07:00`);
        const endMs = Date.parse(`${datePart}T${item.endTime}:00+07:00`);
        if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) {
          continue;
        }

        courtMap.set(courtId, courtName);
        items.push({ courtId, courtName, startMs, endMs });
      }
    }

    const courtNamesList = Array.from(courtMap.values()).sort((a, b) =>
      a.localeCompare(b),
    );

    const boundaries = Array.from(
      new Set(items.flatMap(item => [item.startMs, item.endMs])),
    ).sort((a, b) => a - b);

    const schedule: Array<{
      startTime: string;
      endTime: string;
      activeCourts: number;
      courtNames: string;
    }> = [];

    for (let i = 0; i < boundaries.length - 1; i += 1) {
      const startMs = boundaries[i];
      const endMs = boundaries[i + 1];
      if (startMs >= endMs) continue;

      const active = items.filter(item => item.startMs < endMs && item.endMs > startMs);
      if (active.length === 0) continue;

      const activeNames = Array.from(
        new Set(active.map(item => item.courtName)),
      ).sort((a, b) => a.localeCompare(b));

      const entry = {
        startTime: new Date(startMs).toISOString(),
        endTime: new Date(endMs).toISOString(),
        activeCourts: activeNames.length,
        courtNames: activeNames.join(', '),
      };

      const last = schedule[schedule.length - 1];
      if (
        last &&
        last.endTime === entry.startTime &&
        last.activeCourts === entry.activeCourts &&
        last.courtNames === entry.courtNames
      ) {
        last.endTime = entry.endTime;
      } else {
        schedule.push(entry);
      }
    }

    const sessionStartTime = items.length > 0
      ? new Date(Math.min(...items.map(i => i.startMs)))
      : null;
    const sessionEndTime = items.length > 0
      ? new Date(Math.max(...items.map(i => i.endMs)))
      : null;

    return {
      numberOfCourts: courtMap.size,
      courtNames: courtNamesList.join(', '),
      courtSchedule: schedule,
      sessionStartTime,
      sessionEndTime,
    };
  }

  /**
   * Creates a new play session
   */
  async create(createSessionDto: CreateSessionDto, userId: string, socialId: string) {
    // Check if user is creator of the social event
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: {
        creatorId: true,
        isFree: true,
        status: true,
      },
    });

    // If social not found
    if (!social) {
      throw new BadRequestException('Social not found');
    }

    if (social.status === SocialStatus.CANCELLED || social.status === SocialStatus.COMPLETED) {
      throw new BadRequestException('Cannot create play session in a cancelled or completed social');
    }

    // If user is not the creator
    if (social.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can create play sessions');
    }

    // Get info from bookingIds
    const bookingInfos = await this.centerAxios
      .post('/api/bookings/batch', {
        bookingIds: createSessionDto.bookingIds,
      })
      .then(res => res.data.bookingInfos)
      .catch(err => {
        throw new BadRequestException('Failed to fetch booking infos: ' + err.message);
      });

    // Validate booking infos
    if (!Array.isArray(bookingInfos) || bookingInfos.length === 0) {
      throw new BadRequestException('No bookings found for provided bookingIds');
    }

    const firstCenterId = bookingInfos[0]?.center?.id;
    if (!firstCenterId) {
      throw new BadRequestException('Invalid booking info response');
    }

    // check all bookings belong to the same center
    const isSameCenter = bookingInfos.every(
      b => b?.center?.id === firstCenterId,
    );

    if (!isSameCenter) {
      throw new BadRequestException(
        'All bookings must belong to the same center',
      );
    }

    // Check if name session exists for the social
    const existing = await this.prisma.playSession.findFirst({
      where: { title: createSessionDto.title, socialId },
    });

    if (existing) {
      throw new BadRequestException('A play session with the same title already exists in this social');
    }

    // Get center info for location and fee calculation
    const center = bookingInfos[0].center;
    const location = center.address ? `${center.name}, ${center.address}` : center.name;
    let sessionFee = createSessionDto.sessionFee ?? 0;
    if (social.isFree) {
      if (createSessionDto.sessionFee !== undefined && createSessionDto.sessionFee > 0) {
        throw new BadRequestException('Cannot set non-zero fee for a session in a free social event');
      }
      sessionFee = 0;
    }
    const { numberOfCourts, courtNames, courtSchedule, sessionStartTime, sessionEndTime } =
      this.buildCourtSummary(bookingInfos);

    // Validate that derived session times are in the future
    const now = new Date();
    if (!sessionStartTime || !sessionEndTime) {
      throw new BadRequestException('Could not derive session time from booking data');
    }
    if (sessionStartTime.getTime() <= now.getTime()) {
      throw new BadRequestException('Session start time (from bookings) must be in the future');
    }

    // Create play session
    const playSession = await this.prisma.playSession.create({
      data: {
        title: createSessionDto.title,
        socialId,
        bookingIds: createSessionDto.bookingIds,
        numberOfCourts,
        courtNames,
        courtSchedule: courtSchedule as any,
        location,
        sessionFee,
        startTime: sessionStartTime,
        endTime: sessionEndTime,
        joinedCount: 0,
        creatorId: userId,
        centerId: center.id ?? null,
        centerName: center.name ?? null,
        maxSlots: createSessionDto.maxSlots ?? createSessionDto.maxSlot,
      },
    });

    // Link bookings to the play session in Center Service
    try {
      await this.centerAxios.post('/api/bookings/link-play-session', {
        bookingIds: createSessionDto.bookingIds,
        playSessionId: playSession.id,
      });
    } catch (error) {
      await this.prisma.playSession.delete({
        where: { id: playSession.id },
      });
      throw new BadRequestException('Failed to link bookings to play session');
    }

    // Auto-seed the host's PSP row so the host is always on the play session
    // roster, even before the lifecycle Start step runs (which would have
    // bulk-seeded everyone). The host is the SocialParticipant flagged
    // isHost=true (only present when the social was created with hostRole=
    // HOST_AND_PLAY). Best-effort: a failure here doesn't roll back the
    // session — lifecycle Start's `skipDuplicates` bulk seed catches up later.
    let isParticipant = false;
    try {
      const hostParticipant = await this.prisma.socialParticipant.findFirst({
        where: {
          socialId,
          isHost: true,
          status: SocialParticipantStatus.CONFIRMED,
        },
        select: { userId: true },
      });
      if (hostParticipant?.userId) {
        await this.prisma.playSessionParticipant.create({
          data: {
            playSessionId: playSession.id,
            userId: hostParticipant.userId,
            status: PlaySessionParticipantStatus.CONFIRMED,
          },
        });
        if (hostParticipant.userId === userId) {
          isParticipant = true;
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to seed host PSP for play session ${playSession.id}: ${error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // Cache session time for social
    await this.updateSocialTimeCache(socialId);
    await this.updateSocialBookingCost(socialId);

    return {
      message: 'Created play session successfully.',
      data: {
        ...playSession,
        maxSlot: playSession.maxSlots,
        isHost: social.creatorId === userId,
        isParticipant,
        status: 'PUBLISHED',
      },
    };
  }

  /**
   * Helper method to update cached startTime and endTime in Social based on its play sessions
   */
  private async updateSocialTimeCache(socialId: string) {
    const timeAgg = await this.prisma.playSession.aggregate({
      where: { socialId, status: { not: PlaySessionStatus.CANCELLED } },
      _min: { startTime: true },
      _max: { endTime: true },
    });

    await this.prisma.social.update({
      where: { id: socialId, status: { not: PlaySessionStatus.CANCELLED } },
      data: {
        startTime: timeAgg._min.startTime ?? null,
        endTime: timeAgg._max.endTime ?? null,
      },
    });
  }

  /**
   * Helper method to update cached total booking cost in Social based on its play sessions
   */
  private async updateSocialBookingCost(socialId: string) {
    const sessions = await this.prisma.playSession.findMany({
      where: { socialId, status: { not: PlaySessionStatus.CANCELLED } },
      select: { bookingIds: true },
    });

    const bookingIds = Array.from(
      new Set(sessions.flatMap(s => s.bookingIds || [])),
    ).filter(Boolean);

    let totalBookingCost = 0;

    if (bookingIds.length > 0) {
      const bookingInfos = await this.centerAxios
        .post('/api/bookings/batch', { bookingIds })
        .then(res => res.data.bookingInfos)
        .catch(err => {
          this.logger.error(
            `Failed to fetch booking batch for social ${socialId}: ${err instanceof Error ? err.message : String(err)}`,
          );
          return [];
        });

      if (Array.isArray(bookingInfos)) {
        totalBookingCost = bookingInfos.reduce(
          (sum, booking) => sum + Number(booking.totalPrice ?? 0),
          0,
        );
      }
    }

    const aggregate = await this.prisma.socialExpense.aggregate({
      where: { socialId },
      _sum: {
        amount: true,
      },
    });
    const sumExpenses = aggregate._sum.amount ?? 0;

    await this.prisma.social.update({
      where: { id: socialId, status: { not: PlaySessionStatus.CANCELLED } },
      data: {
        totalBookingCost,
        totalExpense: totalBookingCost + sumExpenses,
      },
    });
  }

  /**
   * Lists all play sessions for a social
   */
  async listBySocial(socialId: string, userId?: string) {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: { id: true, creatorId: true },
    });

    if (!social) {
      throw new NotFoundException('Social not found');
    }

    const sessions = await this.prisma.playSession.findMany({
      where: { socialId },
      orderBy: { startTime: 'asc' },
    });

    const creatorIds = Array.from(new Set(sessions.map((s) => s.creatorId)));
    const creators = creatorIds.length > 0 ? await this.userService.getManyUsersByIds(creatorIds) : [];
    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    let userParticipants: string[] = [];
    if (userId && sessions.length > 0) {
      const psps = await this.prisma.playSessionParticipant.findMany({
        where: {
          playSessionId: { in: sessions.map(s => s.id) },
          userId,
          status: { not: PlaySessionParticipantStatus.CANCELLED },
        },
        select: { playSessionId: true },
      });
      userParticipants = psps.map(p => p.playSessionId);
    }

    const data = sessions.map((session) => {
      let mappedStatus: 'PUBLISHED' | 'COMPLETED' | 'CANCELLED' = 'PUBLISHED';
      if (session.status === PlaySessionStatus.COMPLETED) {
        mappedStatus = 'COMPLETED';
      } else if (session.status === PlaySessionStatus.CANCELLED) {
        mappedStatus = 'CANCELLED';
      }

      return {
        ...session,
        maxSlot: session.maxSlots,
        creator: creatorMap.get(session.creatorId) || null,
        isHost: userId ? social.creatorId === userId : false,
        isParticipant: userId ? userParticipants.includes(session.id) : false,
        status: mappedStatus,
      };
    });

    return {
      message: 'Play sessions fetched successfully.',
      data,
    };
  }

  /**
   * Gets details of a play session by id
   */
  async getDetail(socialId: string, sessionId: string, userId?: string) {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: { id: true, creatorId: true },
    });

    if (!social) {
      throw new NotFoundException('Social not found');
    }

    const session = await this.prisma.playSession.findFirst({
      where: { id: sessionId, socialId },
    });

    if (!session) {
      throw new NotFoundException('Play session not found');
    }

    const creator = await this.userService.getUserById(session.creatorId);

    let mappedStatus: 'PUBLISHED' | 'COMPLETED' | 'CANCELLED' = 'PUBLISHED';
    if (session.status === PlaySessionStatus.COMPLETED) {
      mappedStatus = 'COMPLETED';
    } else if (session.status === PlaySessionStatus.CANCELLED) {
      mappedStatus = 'CANCELLED';
    }

    let isParticipant = false;
    if (userId) {
      const psp = await this.prisma.playSessionParticipant.findFirst({
        where: {
          playSessionId: sessionId,
          userId,
          status: { not: PlaySessionParticipantStatus.CANCELLED },
        },
      });
      isParticipant = !!psp;
    }

    return {
      message: 'Play session fetched successfully.',
      data: {
        ...session,
        maxSlot: session.maxSlots,
        creator,
        isHost: userId ? social.creatorId === userId : false,
        isParticipant,
        status: mappedStatus,
      },
    };
  }

  /**
   * Updates a play session
   */
  async update(
    socialId: string,
    sessionId: string,
    updateSessionDto: UpdateSessionDto,
    userId: string,
  ) {
    // Fetch social
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: {
        id: true,
        status: true,
        creatorId: true,
        isFree: true,
      },
    });

    // If social not found
    if (!social) {
      throw new NotFoundException('Social not found');
    }

    // If social is cancelled or completed, cannot update session
    if (social.status === SocialStatus.CANCELLED || social.status === SocialStatus.COMPLETED) {
      throw new BadRequestException('Cannot update play session in a cancelled or completed social');
    }

    // Fetch session
    const session = await this.prisma.playSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, title: true, startTime: true, endTime: true, bookingIds: true, sessionFee: true },
    });

    // If session not found
    if (!session) {
      throw new NotFoundException('Play session not found');
    }

    // If session is cancelled, cannot update
    if (session.status === PlaySessionStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a cancelled play session');
    }

    // Only creator can update session
    if (social.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can update play sessions');
    }

    // Cannot update bookingIds if session has already started
    if (social.status === SocialStatus.PUBLISHED && updateSessionDto.bookingIds) {
      throw new BadRequestException('Cannot update bookingIds when social is already published');
    }

    // Block updating sessionFee if social is published
    if (social.status === SocialStatus.PUBLISHED && updateSessionDto.sessionFee !== undefined && updateSessionDto.sessionFee !== session.sessionFee) {
      throw new BadRequestException('Cannot update sessionFee when social is already published');
    }

    if (updateSessionDto.title && updateSessionDto.title !== session.title) {
      const existing = await this.prisma.playSession.findFirst({
        where: { title: updateSessionDto.title, socialId },
      });
      if (existing) {
        throw new BadRequestException('A play session with the same title already exists in this social');
      }
    }

    // Prepare update data (startTime/endTime are derived from bookings, not from DTO)
    const updateData: any = {
      title: updateSessionDto.title,
    };

    const maxSlotsVal = updateSessionDto.maxSlots ?? updateSessionDto.maxSlot;
    if (maxSlotsVal !== undefined) {
      updateData.maxSlots = maxSlotsVal;
    }

    if (updateSessionDto.bookingIds) {
      const bookingInfos = await this.centerAxios
        .post('/api/bookings/batch', {
          bookingIds: updateSessionDto.bookingIds,
        })
        .then(res => res.data.bookingInfos)
        .catch(err => {
          throw new BadRequestException('Failed to fetch booking infos: ' + err.message);
        });

      if (!Array.isArray(bookingInfos) || bookingInfos.length === 0) {
        throw new BadRequestException('No bookings found for provided bookingIds');
      }

      const firstCenterId = bookingInfos[0]?.center?.id;
      if (!firstCenterId) {
        throw new BadRequestException('Invalid booking info response');
      }

      const isSameCenter = bookingInfos.every(
        b => b?.center?.id === firstCenterId,
      );

      if (!isSameCenter) {
        throw new BadRequestException(
          'All bookings must belong to the same center',
        );
      }

      // Check if name session exists for the social
      const existing = await this.prisma.playSession.findFirst({
        where: { title: updateSessionDto.title, socialId },
      });

      if (existing) {
        throw new BadRequestException('A play session with the same title already exists in this social');
      }

      const center = bookingInfos[0].center;
      const location = center.address ? `${center.name}, ${center.address}` : center.name;
      const summary = this.buildCourtSummary(bookingInfos);

      updateData.bookingIds = updateSessionDto.bookingIds;
      updateData.location = location;
      updateData.numberOfCourts = summary.numberOfCourts;
      updateData.courtNames = summary.courtNames;
      updateData.courtSchedule = summary.courtSchedule as any;
      updateData.centerId = center.id ?? null;
      updateData.centerName = center.name ?? null;
      // Re-derive startTime/endTime from the new bookings
      if (summary.sessionStartTime) updateData.startTime = summary.sessionStartTime;
      if (summary.sessionEndTime) updateData.endTime = summary.sessionEndTime;
    }

    if (updateSessionDto.sessionFee !== undefined) {
      if (social.isFree) {
        if (updateSessionDto.sessionFee > 0) {
          throw new BadRequestException('Cannot set non-zero fee for a session in a free social event');
        }
        updateData.sessionFee = 0;
      } else {
        updateData.sessionFee = updateSessionDto.sessionFee;
      }
    }

    if (updateSessionDto.bookingIds) {
      const oldBookingIds = session.bookingIds ?? [];
      const newBookingIds = updateSessionDto.bookingIds;

      // Remove duplicates
      const uniqueOldIds = Array.from(new Set(oldBookingIds));
      const uniqueNewIds = Array.from(new Set(newBookingIds));

      // Calculate diff
      const bookingIdsToAdd = uniqueNewIds.filter(
        (id) => !uniqueOldIds.includes(id),
      );

      const bookingIdsToRemove = uniqueOldIds.filter(
        (id) => !uniqueNewIds.includes(id),
      );


      // Link bookings to this play session
      let playSessionUpdated = false;

      try {
        // Step 1: Link new bookings to the play session in Center Service
        if (bookingIdsToAdd.length > 0) {
          await this.centerAxios.post(
            '/api/bookings/link-play-session',
            {
              bookingIds: bookingIdsToAdd,
              playSessionId: sessionId,
            },
          );
        }

        // Step 2: Update play session's bookingIds in DB
        await this.prisma.playSession.update({
          where: {
            id: sessionId,
          },

          data: {
            bookingIds: uniqueNewIds,
          },
        });

        playSessionUpdated = true;

        // Step 3: Unlink old bookings from the play session
        if (bookingIdsToRemove.length > 0) {
          await this.centerAxios.post(
            '/api/bookings/unlink-play-session',
            {
              bookingIds: bookingIdsToRemove,
              playSessionId: sessionId,
            },
          );
        }
      } catch (error) {

        // Only rollback if DB update failed
        if (!playSessionUpdated && bookingIdsToAdd.length > 0) {
          try {
            await this.centerAxios.post(
              '/api/bookings/unlink-play-session',
              {
                bookingIds: bookingIdsToAdd,
                playSessionId: sessionId,
              },
            );
          } catch (rollbackError) {
            this.logger.error(
              'Failed to rollback newly linked bookings',
              rollbackError,
            );
          }
        }

        throw new BadRequestException(
          'Failed to update booking links for play session',
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.playSession.update({
        where: { id: sessionId },
        data: updateData,
      });

      // If sessionFee changed, recalculate fee for all active participants who are NOT full package
      if (updateSessionDto.sessionFee !== undefined && updateSessionDto.sessionFee !== session.sessionFee) {
        const pspUserIds = await tx.playSessionParticipant.findMany({
          where: { playSessionId: sessionId, status: PlaySessionParticipantStatus.CONFIRMED },
          select: { userId: true },
        }).then(psps => psps.map(psp => psp.userId).filter((uid): uid is string => Boolean(uid)));

        if (pspUserIds.length > 0) {
          const nonFullPackageParts = await tx.socialParticipant.findMany({
            where: {
              socialId,
              isFullPackage: false,
              status: { not: SocialParticipantStatus.CANCELLED },
              userId: { in: pspUserIds },
            },
            select: { id: true },
          });
          for (const part of nonFullPackageParts) {
            await this.socialParticipantService.recalculateParticipantTotalFee(tx, part.id);
          }
        }
      }

      return res;
    });

    // If bookingIds changed, startTime/endTime and booking cost are re-derived — update both caches
    if (updateSessionDto.bookingIds) {
      await this.updateSocialTimeCache(socialId);
      await this.updateSocialBookingCost(socialId);
    }

    let isParticipant = false;
    if (userId) {
      const psp = await this.prisma.playSessionParticipant.findFirst({
        where: {
          playSessionId: sessionId,
          userId,
          status: { not: PlaySessionParticipantStatus.CANCELLED },
        },
      });
      isParticipant = !!psp;
    }

    return {
      message: 'Play session updated successfully.',
      data: {
        ...updated,
        maxSlot: updated.maxSlots,
        isHost: social.creatorId === userId,
        isParticipant,
        status: updated.status === PlaySessionStatus.COMPLETED ? 'COMPLETED' : (updated.status === PlaySessionStatus.CANCELLED ? 'CANCELLED' : 'PUBLISHED'),
      },
    };
  }

  /**
   * Deletes a play session
   */
  async remove(socialId: string, sessionId: string, userId: string) {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: {
        id: true,
        creatorId: true,
        status: true,
      },
    });

    if (!social) {
      throw new NotFoundException('Social not found');
    }

    if (social.status === SocialStatus.CANCELLED || social.status === SocialStatus.COMPLETED) {
      throw new BadRequestException('Cannot delete play session in a cancelled or completed social');
    }

    const session = await this.prisma.playSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, bookingIds: true },
    });

    if (!session) {
      throw new NotFoundException('Play session not found');
    }

    if (social.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can delete play sessions');
    }

    const existing = await this.prisma.playSession.findFirst({
      where: { id: sessionId, socialId },
    });

    if (!existing) {
      throw new NotFoundException('Play session not found');
    }

    try {
      await this.centerAxios.post('/api/bookings/unlink-play-session', {
        bookingIds: session.bookingIds,
        playSessionId: sessionId,
      });
    } catch (error) {
      throw new BadRequestException('Failed to unlink bookings from play session');
    }

    await this.prisma.$transaction(async (tx) => {
      // Find all participants who are CONFIRMED in this session and NOT full package
      const pspUserIds = await tx.playSessionParticipant.findMany({
        where: { playSessionId: sessionId, status: PlaySessionParticipantStatus.CONFIRMED },
        select: { userId: true },
      }).then(psps => psps.map(psp => psp.userId).filter((uid): uid is string => Boolean(uid)));

      await tx.playSession.delete({
        where: { id: sessionId },
      });

      // Recalculate fees for those participants
      if (pspUserIds.length > 0) {
        const nonFullPackageParts = await tx.socialParticipant.findMany({
          where: {
            socialId,
            isFullPackage: false,
            status: { not: SocialParticipantStatus.CANCELLED },
            userId: { in: pspUserIds },
          },
          select: { id: true },
        });
        for (const part of nonFullPackageParts) {
          await this.socialParticipantService.recalculateParticipantTotalFee(tx, part.id);
        }
      }
    });

    // After deletion, update the cached time and booking cost in Social
    await this.updateSocialTimeCache(socialId);
    await this.updateSocialBookingCost(socialId);

    return {
      message: 'Play session deleted successfully.',
    };
  }

  /**
   * Cancels a play session
   */
  async cancel(socialId: string, sessionId: string, userId: string) {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: {
        id: true,
        status: true,
        creatorId: true,
      },
    });

    if (!social) {
      throw new NotFoundException('Social not found');
    }

    if (social.status === SocialStatus.CANCELLED || social.status === SocialStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel play session in a cancelled or completed social');
    }

    if (social.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can cancel play sessions');
    }

    const existing = await this.prisma.playSession.findFirst({
      where: { id: sessionId, socialId },
      select: { id: true, status: true, bookingIds: true },
    });

    if (!existing) {
      throw new NotFoundException('Play session not found');
    }

    if (existing.status === PlaySessionStatus.CANCELLED) {
      throw new BadRequestException('Play session already cancelled');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.playSession.update({
        where: { id: sessionId },
        data: { status: PlaySessionStatus.CANCELLED },
      });

      // Find all participants who are CONFIRMED in this session and NOT full package
      const pspUserIds = await tx.playSessionParticipant.findMany({
        where: { playSessionId: sessionId, status: PlaySessionParticipantStatus.CONFIRMED },
        select: { userId: true },
      }).then(psps => psps.map(psp => psp.userId).filter((uid): uid is string => Boolean(uid)));

      if (pspUserIds.length > 0) {
        const nonFullPackageParts = await tx.socialParticipant.findMany({
          where: {
            socialId,
            isFullPackage: false,
            status: { not: SocialParticipantStatus.CANCELLED },
            userId: { in: pspUserIds },
          },
          select: { id: true },
        });
        for (const part of nonFullPackageParts) {
          await this.socialParticipantService.recalculateParticipantTotalFee(tx, part.id);
        }
      }

      return res;
    });

    try {
      await this.centerAxios.post('/api/bookings/unlink-play-session', {
        bookingIds: existing.bookingIds,
        playSessionId: sessionId,
      });
    } catch (error) {
      throw new BadRequestException('Failed to unlink bookings from play session');
    }

    // After cancellation, update the cached time and booking cost in Social
    await this.updateSocialTimeCache(socialId);
    await this.updateSocialBookingCost(socialId);

    return {
      message: 'Play session cancelled successfully.',
      data: {
        ...updated,
        isHost: social.creatorId === userId,
        status: 'CANCELLED',
      },
    };
  }
}