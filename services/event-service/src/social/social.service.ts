import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SocialFormat, SocialHostRole, SocialStatus, PlaySessionParticipantStatus, SocialParticipantStatus, ParticipantPaymentStatus, PlaySessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateSocialDto, SocialAgeGroupDto, SocialGenderPolicyDto, SocialHostRoleDto } from './dto/create-social.dto';
import { MyScheduleQueryDto } from './dto/my-schedule-query.dto';
import { UpdateSocialDto } from './dto/update-social.dto';
import { DiscoverSocialsDto } from './dto/discover-socials.dto';
import { DuplicateSocialDto } from './dto/duplicate-social.dto';
import { SubmitSocialFeedbackDto } from './dto/submit-feedback.dto';
import axios, { AxiosInstance } from 'axios';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../user/user.service';
import { SocialParticipantService } from './participant/social-participant.service';

type TextSearchFilter = {
  contains: string;
  mode: 'insensitive';
};

interface UserProfileInfo {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  district: string | null;
  selfRating: number | null;
  gender: string | null;
  dupr: {
    rating: number | null;
    singlesRating: number | null;
    doublesRating: number | null;
  } | null;
}

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);
  private readonly notificationAxios: AxiosInstance;
  private readonly centerAxios: AxiosInstance;
  private readonly matchAxios: AxiosInstance;
  private readonly userAxios: AxiosInstance;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
    private readonly socialParticipantService: SocialParticipantService,
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

    // Init axios to call Match Service internal api
    const MatchServiceUrl = this.configService.get<string>('MATCH_SERVICE_URL');
    const matchToken = this.configService.get<string>('SERVICE_INTERNAL_TOKEN');

    this.matchAxios = axios.create({
      baseURL: MatchServiceUrl,
      headers: {
        'x-internal-service-token': matchToken,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    // Init axios to call User Service internal api
    const UserServiceUrl = this.configService.get<string>('USER_SERVICE_URL');
    const userToken = this.configService.get<string>('SERVICE_INTERNAL_TOKEN');

    this.userAxios = axios.create({
      baseURL: UserServiceUrl,
      headers: {
        'x-internal-service-token': userToken,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  /**
   * Create a new social from explicit route context.
   * Is already refactor to Social
   */
  async create(
    createSocialDto: CreateSocialDto,
    creatorId: string,
  ) {
    this.ensureUuid(creatorId, 'creatorId');
    this.validateLevelRange(
      createSocialDto.minimumLevel,
      createSocialDto.maximumLevel,
    );



    // Resolve effective defaults once so the row, the bookkeeping fields
    // (joinedCount / hasAvailableSlots), and the host-participant branch
    // below all see the same value. The previous version checked
    // `createSocialDto.hostRole === 'HOST_AND_PLAY'`, which is `false` when
    // the caller omits the field even though the social itself is created
    // with HOST_AND_PLAY by default — so the host never got auto-joined.
    const effectiveHostRole =
      createSocialDto.hostRole ?? SocialHostRoleDto.HOST_AND_PLAY;
    const hostAutoJoins = effectiveHostRole === SocialHostRoleDto.HOST_AND_PLAY;
    const initialJoinedCount = hostAutoJoins ? 1 : 0;

    const social = await this.prisma.social.create({
      data: {
        title: createSocialDto.title,
        note: createSocialDto.note,
        format: createSocialDto.format ?? SocialFormat.SOCIAL,
        startTime: createSocialDto.startTime
          ? new Date(createSocialDto.startTime)
          : undefined,
        endTime: createSocialDto.endTime
          ? new Date(createSocialDto.endTime)
          : undefined,

        status: SocialStatus.DRAFT, // Created as DRAFT, organizer can publish it when ready
        autoApproveJoinRequests: createSocialDto.autoApproveJoinRequests ?? true,
        submitDupr: createSocialDto.submitDupr ?? false,
        minimumLevel:
          createSocialDto.minimumLevel !== undefined
            ? new Prisma.Decimal(createSocialDto.minimumLevel)
            : undefined,
        maximumLevel:
          createSocialDto.maximumLevel !== undefined
            ? new Prisma.Decimal(createSocialDto.maximumLevel)
            : undefined,
        genderPolicy: createSocialDto.genderPolicy ?? SocialGenderPolicyDto.ANY,
        ageGroup: createSocialDto.ageGroup ?? SocialAgeGroupDto.ANY,
        hostRole: effectiveHostRole,
        isFree: createSocialDto.isFree ?? false,
        packageFee: createSocialDto.isFree ? 0 : createSocialDto.packageFee,
        paymentBankName: createSocialDto.paymentBankName,
        paymentAccountName: createSocialDto.paymentAccountName,
        paymentAccountNumber: createSocialDto.paymentAccountNumber,
        paymentQrUrl: createSocialDto.paymentQrUrl,
        paymentNote: createSocialDto.paymentNote,
        joinedCount: initialJoinedCount,
        hasAvailableSlots: true,
        creatorId,
      },
      include: {
        playSessions: true,
        participants: {
          where: {
            status: SocialParticipantStatus.CONFIRMED,
          },
        },
      },
    });

    // create participant record for the creator as host
    if (hostAutoJoins) {
      await this.prisma.socialParticipant.create({
        data: {
          socialId: social.id,
          userId: creatorId,
          status: SocialParticipantStatus.CONFIRMED,
          paymentStatus: ParticipantPaymentStatus.PAID,
          isHost: true,
          isFullPackage: true,
          totalFee: 0,
        }
      });
    }

    return {
      message: 'Social created',
      data: social,
    };
  }

  private async fetchUserProfile(userId: string): Promise<UserProfileInfo | null> {
    try {
      const response = await this.userAxios.post('/api/users/internal/batch', { userIds: [userId] });
      const profiles = response.data;
      if (Array.isArray(profiles) && profiles.length > 0) {
        return profiles[0];
      }
      return null;
    } catch (error) {
      this.logger.warn(`Error fetching user profile: ${error}`);
      return null;
    }
  }

  private async fetchUserFavoriteCenters(userId: string): Promise<string[]> {
    try {
      const response = await this.centerAxios.post('/api/sport-centers/internal/favourites/user', { userId });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      this.logger.warn(`Error fetching user favorite centers: ${error}`);
      return [];
    }
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private normalizeText(value?: string | null) {
    return value?.trim().toLowerCase() ?? '';
  }

  private matchesLocationText(locationText: string, searchKey: string): boolean {
    if (!locationText || !searchKey) return false;
    const normalizedLoc = this.normalizeText(locationText);
    const normalizedKey = this.normalizeText(searchKey);
    if (normalizedLoc.includes(normalizedKey)) return true;

    const removeDiacritics = (str: string) => {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
    };
    return removeDiacritics(normalizedLoc).includes(removeDiacritics(normalizedKey));
  }

  private matchesAnyText(texts: string[], queryKey: string): boolean {
    return texts.some((text) => this.matchesLocationText(text, queryKey));
  }

  /**
   * Discover socials with flexible filters and pagination.
   */
  async discover(
    query: DiscoverSocialsDto,
    userId?: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SocialWhereInput = {};

    // 1. Search filter on title and note
    if (query.search?.trim()) {
      const keyword = query.search.trim();
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { note: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    // 2. Timeframe filter
    const startFrom = query.startFrom ? new Date(query.startFrom) : undefined;
    const startTo = query.startTo ? new Date(query.startTo) : undefined;

    if (startFrom || startTo) {
      where.startTime = {
        ...(startFrom ? { gte: startFrom } : {}),
        ...(startTo ? { lte: startTo } : {}),
      };
    } else if (query.upcoming) {
      where.startTime = { gte: new Date() };
    }

    // 3. has available slots filter
    if (query.hasAvailableSlots) {
      where.hasAvailableSlots = true;
    }

    // 4. skill level filter
    if (query.minimumLevel !== undefined) {
      where.minimumLevel = { gte: new Prisma.Decimal(query.minimumLevel) };
    }

    if (query.maximumLevel !== undefined) {
      where.maximumLevel = { lte: new Prisma.Decimal(query.maximumLevel) };
    }

    // 5. format filter
    if (query.format) {
      where.format = query.format;
    }

    // 6. gender filter
    if (query.genderPolicy) {
      where.genderPolicy = query.genderPolicy;
    }

    // 7. age group filter
    if (query.ageGroup) {
      where.ageGroup = query.ageGroup;
    }

    // 8. Only show published socials in discovery
    where.status = SocialStatus.PUBLISHED;

    const include: Prisma.SocialInclude = {
      playSessions: true,
      _count: {
        select: {
          participants: {
            where: {
              status: SocialParticipantStatus.CONFIRMED,
            },
          },
          playSessions: true,
        },
      },
    };

    if (userId) {
      include.participants = {
        where: {
          userId,
        },
        select: {
          userId: true,
          status: true,
        },
      };
    }

    const [socials, total] = await Promise.all([
      this.prisma.social.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include,
      }),
      this.prisma.social.count({ where }),
    ]);

    const creatorIds = Array.from(new Set(socials.map((s) => s.creatorId)));
    const creators = creatorIds.length > 0 ? await this.userService.getManyUsersByIds(creatorIds) : [];
    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    const data = socials.map((social) => {
      const isHost = social.creatorId === userId;
      const myParticipantRecord = social.participants?.[0];
      const {
        participants,
        totalBookingCost,
        packageFee,
        totalExpense,
        paymentBankName,
        paymentAccountName,
        paymentAccountNumber,
        paymentQrUrl,
        paymentNote,
        autoApproveJoinRequests,
        hostRole,
        cancellationFreezeHours,
        ...socialRest
      } = social;

      return {
        ...socialRest,
        creator: creatorMap.get(social.creatorId) || null,
        isHost,
        isParticipant: !!myParticipantRecord,
        MyParticipantStatus: myParticipantRecord ? myParticipantRecord.status : null,
        distance: null,
        personalizedScore: null,
      };
    });

    return {
      message: 'Get socials for discovery successfully',
      data: data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  /**
   * List all socials without pagination for internal use.
   */
  async listAll() {
    const socials = await this.prisma.social.findMany();
    const creatorIds = Array.from(new Set(socials.map((s) => s.creatorId)));
    const creators = creatorIds.length > 0 ? await this.userService.getManyUsersByIds(creatorIds) : [];
    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    const data = socials.map((social) => ({
      ...social,
      creator: creatorMap.get(social.creatorId) || null,
    }));

    return {
      message: 'Successfully retrieved socials',
      data: data,
    };
  }

  /**
   * Get personal socials schedule of current user.
   */
  async mySchedule(
    userId: string,
    query: MyScheduleQueryDto,
  ) {
    // pagination
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    // Build where
    const where: Prisma.SocialWhereInput = {};
    const now = new Date();

    // 1. Filter by Time (Upcoming vs History)
    if (query.tab === 'upcoming') {
      where.startTime = { not: null, gte: now };
      if (!query.status) {
        where.status = {
          notIn: [SocialStatus.CANCELLED, SocialStatus.COMPLETED],
        };
      }
    } else if (query.tab === 'history') {
      where.startTime = { not: null, lt: now };
    }

    // 2. Filter by Role (Host vs Player)
    if (query.role === 'host') {
      where.creatorId = userId;
    } else if (query.role === 'player') {
      where.creatorId = { not: userId };
      where.participants = { some: { userId, status: { not: SocialParticipantStatus.CANCELLED } } };
    } else {
      // Default: user is either host or participant
      where.OR = [
        { creatorId: userId },
        { participants: { some: { userId, status: { not: SocialParticipantStatus.CANCELLED } } } },
      ];
    }

    // 3. Filter by Status
    if (query.status) {
      where.status = query.status;
    }

    // 4. Search filter
    if (query.search?.trim()) {
      const keyword = query.search.trim();
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          {
            OR: [
              { title: { contains: keyword, mode: 'insensitive' } },
              { note: { contains: keyword, mode: 'insensitive' } },
            ],
          },
        ];
        delete where.OR;
      } else {
        where.OR = [
          { title: { contains: keyword, mode: 'insensitive' } },
          { note: { contains: keyword, mode: 'insensitive' } },
        ];
      }
    }

    // Get socials with where
    const [socials, total] = await Promise.all([
      this.prisma.social.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              participants: {
                where: {
                  status: SocialParticipantStatus.CONFIRMED,
                },
              },
              playSessions: true,
            },
          },
          participants: {
            where: {
              userId,
            },
            select: {
              userId: true,
              status: true,
            },
          },
        }
      }),
      this.prisma.social.count({ where }),
    ]);

    const creatorIds = Array.from(new Set(socials.map((s) => s.creatorId)));
    const creators = creatorIds.length > 0 ? await this.userService.getManyUsersByIds(creatorIds) : [];
    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    const data = socials.map((social) => {
      const isHost = social.creatorId === userId;
      const myParticipantRecord = social.participants?.[0]; // Because of the where filter, there can only be 0 or 1 participant record for the current user
      const {
        participants,
        totalBookingCost,
        packageFee,
        totalExpense,
        paymentBankName,
        paymentAccountName,
        paymentAccountNumber,
        paymentQrUrl,
        paymentNote,
        autoApproveJoinRequests,
        hostRole,
        cancellationFreezeHours,
        ...socialRest
      } = social;

      return {
        ...socialRest,
        creator: creatorMap.get(social.creatorId) || null,
        isHost,
        isParticipant: !!myParticipantRecord,
        MyParticipantStatus: myParticipantRecord ? myParticipantRecord.status : null,
      }
    });

    return {
      message: 'Get personal schedule successfully',
      data: data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    }
  }

  /**
   * Get one social by id in a fixed context.
   */
  async getOneById(id: string, userId?: string) {
    // Fetch social by social id
    const social = await this.prisma.social.findFirst({
      where: {
        id,
      },
      include: {
        playSessions: {
          orderBy: {
            startTime: 'asc',
          },
        },
        _count: {
          select: {
            participants: {
              where: {
                status: SocialParticipantStatus.CONFIRMED,
              },
            },
            playSessions: true,
          },
        },
      },
    });

    // if not found, throw 404
    if (!social) {
      throw new NotFoundException('Social not found');
    }

    const creatorUser = await this.userService.getUserById(social.creatorId);

    let myParticipantInfo = null;
    if (userId) {
      const myPart = await this.prisma.socialParticipant.findUnique({
        where: {
          socialId_userId: {
            socialId: id,
            userId,
          },
        },
        include: {
          payments: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      if (myPart) {
        const playSessionParticipants = await this.prisma.playSessionParticipant.findMany({
          where: {
            userId,
            playSession: { socialId: id },
            status: PlaySessionParticipantStatus.CONFIRMED,
          },
          select: { playSessionId: true },
        });

        myParticipantInfo = {
          id: myPart.id,
          status: myPart.status,
          totalFee: myPart.totalFee,
          amountPaid: myPart.amountPaid,
          amountRefunded: myPart.amountRefunded,
          amountDue: Math.max(0, myPart.totalFee - (myPart.amountPaid - myPart.amountRefunded)),
          amountOverpaid: Math.max(0, (myPart.amountPaid - myPart.amountRefunded) - myPart.totalFee),
          isFullPackage: myPart.isFullPackage,
          paymentStatus: myPart.paymentStatus,
          joinedAt: myPart.joinedAt,
          joinedSessionIds: playSessionParticipants.map((psp) => psp.playSessionId),
          paymentUrl: myPart.payments?.[0]?.receiptUrl ?? null,
        };
      }
    }

    const isHost = userId ? social.creatorId === userId : false;
    const mappedPlaySessions = (social.playSessions || []).map((session) => {
      let mappedStatus: 'PUBLISHED' | 'COMPLETED' | 'CANCELLED' = 'PUBLISHED';
      if (session.status === PlaySessionStatus.COMPLETED) {
        mappedStatus = 'COMPLETED';
      } else if (session.status === PlaySessionStatus.CANCELLED) {
        mappedStatus = 'CANCELLED';
      }

      return {
        ...session,
        isHost,
        status: mappedStatus,
      };
    });

    return {
      message: 'Social fetched',
      data: {
        ...social,
        playSessions: mappedPlaySessions,
        creator: creatorUser,
        isHost,
        isParticipant: !!myParticipantInfo,
        myParticipantInfo,
      },
    };
  }

  /**
   * Update one social by id in a fixed context.
   */
  async update(
    id: string,
    updateSocialDto: UpdateSocialDto,
    userId: string,
  ) {
    // validate level range
    this.validateLevelRange(
      updateSocialDto.minimumLevel,
      updateSocialDto.maximumLevel,
    );

    // Get updated social
    const existingSocial = await this.prisma.social.findFirst({
      where: {
        id
      },
      select: {
        id: true,
        creatorId: true,
        joinedCount: true,
        playSessions: true,
        status: true,
        packageFee: true,
        isFree: true,
      },
    });

    // if not found, throw 404
    if (!existingSocial) {
      throw new NotFoundException('Social not found');
    }

    // Only allow updating socials that are not cancelled
    if (existingSocial.status === SocialStatus.CANCELLED
      || existingSocial.status === SocialStatus.COMPLETED
    ) {
      throw new BadRequestException('Cannot update this social');
    }

    // Block updating packageFee if social is published
    if (existingSocial.status === SocialStatus.PUBLISHED && updateSocialDto.packageFee !== undefined && updateSocialDto.packageFee !== existingSocial.packageFee) {
      throw new BadRequestException('Cannot update packageFee when social is already published');
    }

    // Check if the user is the creator of the social
    if (existingSocial.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can update this social');
    }

    const actualJoinedCount = await this.prisma.socialParticipant.count({
      where: {
        socialId: id,
        status: SocialParticipantStatus.CONFIRMED,
      },
    });

    const isFreeTarget = updateSocialDto.isFree !== undefined
      ? updateSocialDto.isFree
      : existingSocial.isFree;

    const hasAvailableSlots = true;

    // 5. Build the Update Payload
    const updateData: Prisma.SocialUpdateInput = {
      title: updateSocialDto.title,
      note: updateSocialDto.note,
      format: updateSocialDto.format,
      autoApproveJoinRequests: updateSocialDto.autoApproveJoinRequests,
      submitDupr: updateSocialDto.submitDupr,
      minimumLevel: updateSocialDto.minimumLevel ? new Prisma.Decimal(updateSocialDto.minimumLevel) : undefined,
      maximumLevel: updateSocialDto.maximumLevel ? new Prisma.Decimal(updateSocialDto.maximumLevel) : undefined,
      genderPolicy: updateSocialDto.genderPolicy,
      ageGroup: updateSocialDto.ageGroup,
      cancellationFreezeHours: updateSocialDto.cancellationFreezeHours,
      joinedCount: actualJoinedCount,
      hasAvailableSlots,
      paymentBankName: updateSocialDto.paymentBankName,
      paymentAccountName: updateSocialDto.paymentAccountName,
      paymentAccountNumber: updateSocialDto.paymentAccountNumber,
      paymentQrUrl: updateSocialDto.paymentQrUrl,
      paymentNote: updateSocialDto.paymentNote,
      status: updateSocialDto.status,
      isFree: isFreeTarget,
      packageFee: isFreeTarget ? 0 : updateSocialDto.packageFee,
    };

    // 7. Execute the update inside transaction
    const updatedSocial = await this.prisma.$transaction(async (tx) => {
      // If target state is free, force update all session fees to 0
      if (isFreeTarget) {
        await tx.playSession.updateMany({
          where: { socialId: id },
          data: { sessionFee: 0 },
        });
      }

      const updated = await tx.social.update({
        where: { id },
        data: updateData,
        include: {
          playSessions: true,
        },
      });

      // Recalculate participant fees if isFree target is true (forces everything to 0) or packageFee has changed
      if (isFreeTarget) {
        const activeParts = await tx.socialParticipant.findMany({
          where: { socialId: id, status: { not: SocialParticipantStatus.CANCELLED } },
          select: { id: true },
        });
        for (const part of activeParts) {
          await this.socialParticipantService.recalculateParticipantTotalFee(tx, part.id);
        }
      } else if (updateSocialDto.packageFee !== undefined && updateSocialDto.packageFee !== existingSocial.packageFee) {
        const fullPackageParts = await tx.socialParticipant.findMany({
          where: { socialId: id, isFullPackage: true, status: { not: SocialParticipantStatus.CANCELLED } },
          select: { id: true },
        });
        for (const part of fullPackageParts) {
          await this.socialParticipantService.recalculateParticipantTotalFee(tx, part.id);
        }
      }

      return updated;
    });

    const isHost = updatedSocial.creatorId === userId;
    const mappedPlaySessions = (updatedSocial.playSessions || []).map((session) => {
      let mappedStatus: 'PUBLISHED' | 'COMPLETED' | 'CANCELLED' = 'PUBLISHED';
      if (session.status === PlaySessionStatus.COMPLETED) {
        mappedStatus = 'COMPLETED';
      } else if (session.status === PlaySessionStatus.CANCELLED) {
        mappedStatus = 'CANCELLED';
      }

      return {
        ...session,
        isHost,
        status: mappedStatus,
      };
    });

    return {
      message: 'Social updated successfully',
      data: {
        ...updatedSocial,
        playSessions: mappedPlaySessions,
      }
    };
  }

  /**
   * Publish a social by id.
   */
  async publish(id: string, userId: string) {
    const social = await this.prisma.social.findFirst({
      where: { id: id },
      select: {
        id: true,
        status: true,
        creatorId: true,
        packageFee: true,
        paymentBankName: true,
        paymentAccountName: true,
        paymentAccountNumber: true,
        paymentQrUrl: true,
        isFree: true,
      },
    });

    if (!social) {
      throw new NotFoundException('Social not found');
    }

    if (social.status === SocialStatus.CANCELLED || social.status === SocialStatus.COMPLETED) {
      throw new BadRequestException('Cannot publish this social');
    }

    if (social.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can publish this social');
    }

    if (social.packageFee === null || social.packageFee === undefined) {
      throw new BadRequestException('Package fee is required before publishing');
    }
    if (social.packageFee < 0) {
      throw new BadRequestException('Package fee must be greater than or equal to 0');
    }

    if (!social.isFree) {
      if (!social.paymentBankName || social.paymentBankName.trim() === '') {
        throw new BadRequestException('Payment bank name is required before publishing');
      }

      if (!social.paymentAccountName || social.paymentAccountName.trim() === '') {
        throw new BadRequestException('Payment account name is required before publishing');
      }

      if (!social.paymentAccountNumber || social.paymentAccountNumber.trim() === '') {
        throw new BadRequestException('Payment account number is required before publishing');
      }

      if (!social.paymentQrUrl || social.paymentQrUrl.trim() === '') {
        throw new BadRequestException('Payment QR URL is required before publishing');
      }
    }

    const playSessions = await this.prisma.playSession.findMany({
      where: { socialId: id },
      select: { id: true, sessionFee: true },
    });

    if (playSessions.length === 0) {
      throw new BadRequestException('Cannot publish a social without any play session');
    }

    for (const session of playSessions) {
      if (session.sessionFee === null || session.sessionFee === undefined) {
        throw new BadRequestException('Session fee is required for all play sessions before publishing');
      }
      if (session.sessionFee < 0) {
        throw new BadRequestException('Session fee must be greater than or equal to 0');
      }
    }

    if (social.status === SocialStatus.PUBLISHED) {
      return {
        message: 'Social already published',
        data: social,
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.social.update({
        where: { id },
        data: { status: SocialStatus.PUBLISHED },
      });

      // Sync totalFee for all active participants when social is published (e.g. host auto-joins)
      const participants = await tx.socialParticipant.findMany({
        where: { socialId: id, status: { not: SocialParticipantStatus.CANCELLED } },
        select: { id: true }
      });
      for (const part of participants) {
        await this.socialParticipantService.recalculateParticipantTotalFee(tx, part.id);
      }

      return res;
    });

    return {
      message: 'Social published successfully',
      data: updated,
    };
  }

  /**
   * Complete a social by id.
   */
  async complete(id: string, userId: string) {
    const social = await this.prisma.social.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        creatorId: true,
      },
    });

    if (!social) {
      throw new NotFoundException('Social not found');
    }

    if (social.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can complete this social');
    }

    if (social.status === SocialStatus.COMPLETED) {
      return {
        message: 'Social already completed',
        data: social,
      };
    }

    if (social.status !== SocialStatus.PUBLISHED) {
      throw new BadRequestException('Only published socials can be completed');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Transition all active/in-progress play sessions of this social to COMPLETED
      await tx.playSession.updateMany({
        where: {
          socialId: id,
          status: {
            in: [PlaySessionStatus.ACTIVE, PlaySessionStatus.IN_PROGRESS],
          },
        },
        data: { status: PlaySessionStatus.COMPLETED },
      });

      // Update social status itself
      return tx.social.update({
        where: { id },
        data: { status: SocialStatus.COMPLETED },
      });
    });

    // Compile and cache social statistics
    try {
      await this.compileSocialStats(id);
    } catch (statsError) {
      this.logger.error(`Failed to compile social statistics for completed social ${id}: ${statsError instanceof Error ? statsError.message : String(statsError)}`);
    }

    return {
      message: 'Social completed successfully',
      data: updated,
    };
  }

  async compileSocialStats(socialId: string): Promise<void> {
    // 1. Get play sessions of this social
    const playSessions = await this.prisma.playSession.findMany({
      where: { socialId },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        numberOfCourts: true,
      },
    });

    let totalCourtHours = 0;
    for (const session of playSessions) {
      const start = new Date(session.startTime).getTime();
      const end = new Date(session.endTime).getTime();
      let hours = (end - start) / (3600 * 1000);
      if (isNaN(hours) || hours < 0) {
        hours = 0;
      }
      totalCourtHours += hours * (session.numberOfCourts || 1);
    }

    const playSessionIds = playSessions.map(ps => ps.id);
    let matches: any[] = [];
    if (playSessionIds.length > 0) {
      try {
        const response = await this.matchAxios.post('/api/matches/internal/query-by-sessions', {
          playSessionIds,
          status: 'CONFIRMED',
        });
        matches = Array.isArray(response.data) ? response.data : [];
      } catch (error) {
        this.logger.warn(`Failed to fetch matches for social ${socialId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const playerStatsMap = new Map<string, { matchesPlayed: number; wins: number; losses: number; draws: number }>();

    for (const match of matches) {
      const teamA: string[] = Array.isArray(match.teamA) ? match.teamA : [];
      const teamB: string[] = Array.isArray(match.teamB) ? match.teamB : [];
      const winner = match.winner; // TEAM_A, TEAM_B, DRAW

      const allPlayers = Array.from(new Set([...teamA, ...teamB])).filter(Boolean);
      for (const uId of allPlayers) {
        if (!playerStatsMap.has(uId)) {
          playerStatsMap.set(uId, { matchesPlayed: 0, wins: 0, losses: 0, draws: 0 });
        }
        const record = playerStatsMap.get(uId)!;
        record.matchesPlayed += 1;

        if (winner === 'DRAW') {
          record.draws += 1;
        } else if (winner === 'TEAM_A') {
          if (teamA.includes(uId)) {
            record.wins += 1;
          } else {
            record.losses += 1;
          }
        } else if (winner === 'TEAM_B') {
          if (teamB.includes(uId)) {
            record.wins += 1;
          } else {
            record.losses += 1;
          }
        }
      }
    }

    const userIds = Array.from(playerStatsMap.keys()).filter(Boolean);
    let authUsers: any[] = [];
    let userProfiles: any[] = [];

    if (userIds.length > 0) {
      try {
        authUsers = await this.userService.getManyUsersByIds(userIds);
      } catch (error) {
        this.logger.warn(`Failed to fetch auth users for stats compilation: ${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        const response = await this.userAxios.post('/api/users/internal/batch', { userIds });
        userProfiles = Array.isArray(response.data) ? response.data : [];
      } catch (error) {
        this.logger.warn(`Failed to fetch user profiles for stats compilation: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const playerStats = userIds.map(uId => {
      const authUser = authUsers.find(u => u.id === uId);
      const userProfile = userProfiles.find(u => u.id === uId);
      const stats = playerStatsMap.get(uId)!;

      return {
        userId: uId,
        name: authUser?.name ?? 'Unknown Player',
        avatarUrl: authUser?.avatarUrl ?? null,
        skillLevel: userProfile?.selfRating ?? 0.0,
        matchesPlayed: stats.matchesPlayed,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
      };
    });

    // Sort by wins desc, then matchesPlayed desc
    playerStats.sort((a, b) => b.wins - a.wins || b.matchesPlayed - a.matchesPlayed);

    await this.prisma.socialStats.upsert({
      where: { socialId },
      create: {
        socialId,
        totalMatches: matches.length,
        activePlayers: playerStats.length,
        courtHours: new Prisma.Decimal(totalCourtHours.toFixed(2)),
        playerStats: playerStats as any,
      },
      update: {
        totalMatches: matches.length,
        activePlayers: playerStats.length,
        courtHours: new Prisma.Decimal(totalCourtHours.toFixed(2)),
        playerStats: playerStats as any,
      },
    });
  }

  async getSocialStats(socialId: string, userId: string) {
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

    // Check if the user is the creator
    const isCreator = social.creatorId === userId;

    // Check if the user is a confirmed participant
    const participant = await this.prisma.socialParticipant.findUnique({
      where: {
        socialId_userId: {
          socialId,
          userId,
        },
      },
      select: {
        status: true,
      },
    });

    if (!isCreator && (!participant || participant.status !== SocialParticipantStatus.CONFIRMED)) {
      throw new ForbiddenException('Only confirmed participants or the host can view social statistics');
    }

    if (social.status !== SocialStatus.COMPLETED && social.status !== SocialStatus.PUBLISHED) {
      throw new BadRequestException(`Statistics are only available for published or completed socials (current status: ${social.status})`);
    }

    let stats = await this.prisma.socialStats.findUnique({
      where: { socialId },
    });

    const isOngoing = social.status === SocialStatus.PUBLISHED;
    if (!stats || isOngoing) {
      try {
        await this.compileSocialStats(socialId);
        stats = await this.prisma.socialStats.findUnique({
          where: { socialId },
        });
      } catch (error) {
        this.logger.error(`Failed to compile stats on-demand for social ${socialId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (!stats) {
      throw new NotFoundException('Statistics not found for this social');
    }

    return {
      message: 'Social statistics retrieved successfully',
      data: stats,
    };
  }

  async submitFeedback(socialId: string, userId: string, dto: SubmitSocialFeedbackDto) {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!social) {
      throw new NotFoundException('Social not found');
    }

    if (social.status !== SocialStatus.COMPLETED) {
      throw new BadRequestException('Feedback can only be submitted for completed socials');
    }

    const participant = await this.prisma.socialParticipant.findUnique({
      where: {
        socialId_userId: {
          socialId,
          userId,
        },
      },
      select: {
        status: true,
      },
    });

    if (!participant || participant.status !== SocialParticipantStatus.CONFIRMED) {
      throw new ForbiddenException('Only confirmed participants can submit feedback');
    }

    const feedback = await this.prisma.socialFeedback.upsert({
      where: {
        socialId_userId: {
          socialId,
          userId,
        },
      },
      create: {
        socialId,
        userId,
        ratingVenue: dto.ratingVenue,
        ratingOverall: dto.ratingOverall,
        ratingOrganization: dto.ratingOrganization,
        comment: dto.comment,
      },
      update: {
        ratingVenue: dto.ratingVenue,
        ratingOverall: dto.ratingOverall,
        ratingOrganization: dto.ratingOrganization,
        comment: dto.comment,
      },
    });

    return {
      message: 'Feedback submitted successfully',
      data: feedback,
    };
  }

  async getFeedbackAnalytics(socialId: string) {
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
      select: {
        id: true,
      },
    });

    if (!social) {
      throw new NotFoundException('Social not found');
    }

    const feedbacks = await this.prisma.socialFeedback.findMany({
      where: { socialId },
      orderBy: { createdAt: 'desc' },
    });

    const totalFeedbacks = feedbacks.length;
    let avgVenue = null;
    let avgOverall = null;
    let avgOrganization = null;

    if (totalFeedbacks > 0) {
      const sumVenue = feedbacks.reduce((sum: number, f: any) => sum + f.ratingVenue, 0);
      const sumOverall = feedbacks.reduce((sum: number, f: any) => sum + f.ratingOverall, 0);
      const sumOrganization = feedbacks.reduce((sum: number, f: any) => sum + f.ratingOrganization, 0);

      avgVenue = Number((sumVenue / totalFeedbacks).toFixed(1));
      avgOverall = Number((sumOverall / totalFeedbacks).toFixed(1));
      avgOrganization = Number((sumOrganization / totalFeedbacks).toFixed(1));
    }

    const userIds = feedbacks.map((f: any) => f.userId);
    let authUsers: any[] = [];
    if (userIds.length > 0) {
      try {
        authUsers = await this.userService.getManyUsersByIds(userIds);
      } catch (error) {
        this.logger.warn(`Failed to fetch auth users for feedback analytics: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const comments = feedbacks.map((f: any) => {
      const user = authUsers.find(u => u.id === f.userId);
      return {
        id: f.id,
        userId: f.userId,
        userName: user?.name ?? 'Unknown Player',
        userAvatarUrl: user?.avatarUrl ?? null,
        comment: f.comment,
        ratingVenue: f.ratingVenue,
        ratingOverall: f.ratingOverall,
        ratingOrganization: f.ratingOrganization,
        createdAt: f.createdAt,
      };
    });

    return {
      message: 'Feedback analytics retrieved successfully',
      data: {
        averages: {
          ratingVenue: avgVenue,
          ratingOverall: avgOverall,
          ratingOrganization: avgOrganization,
          totalReviews: totalFeedbacks,
        },
        comments,
      },
    };
  }

  /**
   * Delete one social by id.
   */
  async remove(socialId: string, userId: string, userName: string) {
    // fetch socials
    const social = await this.prisma.social.findUnique({
      where: {
        id: socialId
      },
    });

    // check if social exists
    if (!social) {
      throw new NotFoundException('Social not found');
    }

    // check if the requester is the creator of the social
    if (social.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can delete this social');
    }

    // if the social is already cancelled, return 400
    if (social.status === SocialStatus.CANCELLED) {
      throw new BadRequestException('This social is already cancelled');
    }

    // Fetch all play sessions of this social to get their bookingIds
    const sessions = await this.prisma.playSession.findMany({
      where: { socialId },
      select: { id: true, bookingIds: true },
    });

    // Unlink bookings in Sport Center Service
    for (const session of sessions) {
      if (session.bookingIds && session.bookingIds.length > 0) {
        try {
          await this.centerAxios.post('/api/bookings/unlink-play-session', {
            bookingIds: session.bookingIds,
            playSessionId: session.id,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to unlink bookings for play session ${session.id} of social ${socialId}: ${error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }

    // if published, soft delete by setting status to CANCELLED
    if (social.status !== SocialStatus.DRAFT) {
      await this.prisma.$transaction(async (tx) => {
        // Cancel all play sessions
        await tx.playSession.updateMany({
          where: { socialId },
          data: { status: PlaySessionStatus.CANCELLED },
        });

        // Cancel the social itself
        await tx.social.update({
          where: { id: socialId },
          data: { status: 'CANCELLED' },
        });
      });

      // Fetch participant user IDs to send notifications
      const participantUserIds = await this.prisma.socialParticipant.findMany({
        where: {
          socialId,
        },
        select: {
          userId: true,
        },
      }).then(participants => participants.map(p => p.userId).filter((id): id is string => Boolean(id)));

      // Send notification to participants (best-effort)
      try {
        await this.notificationService.sendInAppNotification(
          participantUserIds,
          'Social Cancelled',
          `The social "${social.title}" has been cancelled by the ${userName}`
        );
      } catch (notifError) {
        this.logger.error(
          `Failed to send cancellation notification for social ${socialId}: ${notifError instanceof Error ? notifError.message : String(notifError)
          }`
        );
      }

    } else {
      // For draft socials, save to delete directly
      await this.prisma.social.delete({
        where: { id: socialId },
      });
    }

    return {
      message: 'Social deleted successfully',
    };
  }

  /**
   * Duplicate social by id
   */
  async duplicate(
    socialId: string,
    userId: string,
    duplicateSocialDto: DuplicateSocialDto,
  ) {
    // Validate newSessions
    if (!duplicateSocialDto.newSessions?.length) {
      throw new BadRequestException('Duplicated social must include at least one play session');
    }

    // Validate duplicate play session titles
    const titleSet = new Set<string>();
    for (const session of duplicateSocialDto.newSessions) {
      if (titleSet.has(session.title)) {
        throw new BadRequestException('Duplicate play session titles are not allowed');
      }
      titleSet.add(session.title);
    }

    // Fetch the social to be duplicated
    const social = await this.prisma.social.findUnique({
      where: { id: socialId },
    });

    // Fetch original sessions to copy session fees if needed
    const originalSessions = await this.prisma.playSession.findMany({
      where: { socialId },
    });

    // if not found, throw 404
    if (!social) {
      throw new NotFoundException('Social not found');
    }

    // Check if the user is the creator of the social
    if (social.creatorId !== userId) {
      throw new ForbiddenException('Not authorized.');
    }

    // Match the create() bookkeeping: if the new caller auto-joins as host,
    // start joinedCount at 1 and seed hasAvailableSlots so the participant
    // service's atomic capacity check stays truthful from row birth.
    const duplicateHostAutoJoins =
      social.hostRole === SocialHostRole.HOST_AND_PLAY;
    const duplicateInitialJoinedCount = duplicateHostAutoJoins ? 1 : 0;

    // Create a new social with the same details
    const newSocial = await this.prisma.social.create({
      data: {
        title: `Social mới từ ${social.title}`,
        note: social.note,
        format: social.format,
        status: SocialStatus.DRAFT,
        isFree: social.isFree,
        packageFee: social.isFree ? 0 : social.packageFee,
        autoApproveJoinRequests: social.autoApproveJoinRequests,
        submitDupr: social.submitDupr,
        minimumLevel: social.minimumLevel ?? undefined,
        maximumLevel: social.maximumLevel ?? undefined,
        genderPolicy: social.genderPolicy,
        ageGroup: social.ageGroup,
        hostRole: social.hostRole,
        cancellationFreezeHours: social.cancellationFreezeHours,
        joinedCount: duplicateInitialJoinedCount,
        hasAvailableSlots: true,
        paymentBankName: social.paymentBankName,
        paymentAccountName: social.paymentAccountName,
        paymentAccountNumber: social.paymentAccountNumber,
        paymentQrUrl: social.paymentQrUrl,
        paymentNote: social.paymentNote,
        creatorId: userId,
      }
    });

    if (duplicateHostAutoJoins) {
      await this.prisma.socialParticipant.create({
        data: {
          socialId: newSocial.id,
          userId,
          status: SocialParticipantStatus.CONFIRMED,
          paymentStatus: ParticipantPaymentStatus.PAID,
          isHost: true,
        }
      });
    }

    let totalBookingCost = 0;
    const playSessionsData = [] as Prisma.PlaySessionCreateManyInput[];
    for (const session of duplicateSocialDto.newSessions) {
      const bookingInfos = await this.centerAxios
        .post('/api/bookings/batch', {
          bookingIds: session.bookingIds,
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
        throw new BadRequestException('All bookings must belong to the same center');
      }

      const center = bookingInfos[0].center;
      const location = center.address ? `${center.name}, ${center.address}` : center.name;
      const sessionBookingCost = bookingInfos.reduce(
        (sum, booking) => sum + Number(booking.totalPrice ?? 0),
        0,
      );
      totalBookingCost += sessionBookingCost;

      const originalSession = originalSessions.find(s => s.title === session.title);
      let sessionFee = session.sessionFee !== undefined
        ? session.sessionFee
        : (originalSession ? originalSession.sessionFee : 0);

      if (social.isFree) {
        if (session.sessionFee !== undefined && session.sessionFee > 0) {
          throw new BadRequestException('Cannot set non-zero fee for a session in a free social event');
        }
        sessionFee = 0;
      }

      const summary = this.buildCourtSummary(bookingInfos);

      playSessionsData.push({
        title: session.title,
        socialId: newSocial.id,
        bookingIds: session.bookingIds,
        numberOfCourts: summary.numberOfCourts,
        courtNames: summary.courtNames,
        courtSchedule: summary.courtSchedule as any,
        location,
        sessionFee,
        startTime: session.startTime,
        endTime: session.endTime,
        creatorId: userId,
      });
    }

    const createdSessions: { id: string; bookingIds: string[] }[] = [];
    try {
      for (const sessionData of playSessionsData) {
        const created = await this.prisma.playSession.create({
          data: sessionData,
        });
        const rawBookingIds = Array.isArray(sessionData.bookingIds)
          ? sessionData.bookingIds
          : [];
        const normalizedBookingIds = rawBookingIds.filter(
          (id: string): id is string => Boolean(id),
        );
        createdSessions.push({
          id: created.id,
          bookingIds: normalizedBookingIds,
        });

        await this.centerAxios.post('/api/bookings/link-play-session', {
          bookingIds: normalizedBookingIds,
          playSessionId: created.id,
        });
      }
    } catch (error) {
      for (const created of createdSessions) {
        try {
          await this.centerAxios.post('/api/bookings/unlink-play-session', {
            bookingIds: created.bookingIds,
            playSessionId: created.id,
          });
        } catch (rollbackError) {
          // Best-effort rollback.
        }
      }

      if (createdSessions.length > 0) {
        await this.prisma.playSession.deleteMany({
          where: { id: { in: createdSessions.map(session => session.id) } },
        });
      }

      await this.prisma.social.delete({
        where: { id: newSocial.id },
      });

      throw new BadRequestException('Failed to link bookings to play sessions');
    }

    const startTimes = playSessionsData.map((session) => new Date(session.startTime));
    const endTimes = playSessionsData.map((session) => new Date(session.endTime));
    const minStartTime = new Date(Math.min(...startTimes.map(time => time.getTime())));
    const maxEndTime = new Date(Math.max(...endTimes.map(time => time.getTime())));
    // totalBookingCost was calculated from booking totalPrice sums in the loop above

    await this.prisma.social.update({
      where: { id: newSocial.id },
      data: {
        startTime: minStartTime,
        endTime: maxEndTime,
        totalBookingCost,
      },
    });

    const duplicatedSocial = await this.prisma.social.findUnique({
      where: { id: newSocial.id },
      include: { playSessions: true },
    });

    if (!duplicatedSocial) {
      throw new NotFoundException('Duplicated social not found');
    }

    const mappedPlaySessions = (duplicatedSocial.playSessions || []).map((session) => ({
      ...session,
      isHost: true,
      status: 'PUBLISHED' as const,
    }));

    return {
      message: 'Social duplicated successfully',
      data: {
        ...duplicatedSocial,
        playSessions: mappedPlaySessions,
      },
    };
  }

  private validateLevelRange(
    minimumLevel?: number,
    maximumLevel?: number,
  ): void {
    if (
      minimumLevel !== undefined &&
      maximumLevel !== undefined &&
      minimumLevel > maximumLevel
    ) {
      throw new BadRequestException('minimumLevel cannot be greater than maximumLevel');
    }
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

    return {
      numberOfCourts: courtMap.size,
      courtNames: courtNamesList.join(', '),
      courtSchedule: schedule,
    };
  }

  private ensureUuid(value: string, fieldName: string): void {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(value)) {
      throw new BadRequestException(`${fieldName} must be a valid UUID`);
    }
  }

  async queryPlayerSocials(userId: string, startDate?: string, endDate?: string) {
    const where: Prisma.SocialWhereInput = {
      OR: [
        { creatorId: userId },
        {
          participants: {
            some: {
              userId,
              status: { not: 'CANCELLED' },
            },
          },
        },
      ],
    };

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    return this.prisma.social.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        playSessions: {
          orderBy: { startTime: 'asc' },
        },
        participants: {
          where: { userId },
          select: { status: true },
        },
      },
    });
  }
}
