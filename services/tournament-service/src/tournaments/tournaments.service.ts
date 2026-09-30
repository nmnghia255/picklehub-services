import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { UpdateTournamentStatusDto } from './dto/update-tournament-status.dto';
import { TournamentStatus, MatchStatus } from '@prisma/client';
import { SportCenterClient } from '../clients/sport-center.client';
import { UserClient } from '../clients/user.client';
import { NotificationClient } from '../clients/notification.client';
import { ChatClient } from '../clients/chat.client';
import { DiscoverTournamentsDto } from './dto/discover-tournaments.dto';
import { PosterService } from './poster/poster.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class TournamentsService {
  private readonly logger = new Logger(TournamentsService.name);

  constructor(
    private prisma: PrismaService,
    private sportCenterClient: SportCenterClient,
    private userClient: UserClient,
    private posterService: PosterService,
    private readonly notificationClient: NotificationClient,
    private readonly chatClient: ChatClient,
  ) { }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async create(createTournamentDto: CreateTournamentDto, organizerId?: string) {
    const regStart = createTournamentDto.registrationStartDate ? new Date(createTournamentDto.registrationStartDate) : null;
    const regEnd = createTournamentDto.registrationEndDate ? new Date(createTournamentDto.registrationEndDate) : null;
    const start = new Date(createTournamentDto.startDate);
    const end = new Date(createTournamentDto.endDate);

    if (regStart && regEnd && regStart > regEnd) {
      throw new BadRequestException('registrationStartDate cannot be after registrationEndDate');
    }
    if (regEnd && regEnd > start) {
      throw new BadRequestException('registrationEndDate cannot be after startDate');
    }
    if (start > end) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    return this.prisma.tournament.create({
      data: {
        ...createTournamentDto,
        organizerId,
        status: TournamentStatus.draft,
        startDate: start,
        endDate: end,
        registrationStartDate: regStart,
        registrationEndDate: regEnd,
      },
    });
  }

  async findMyTournaments(userId: string, role: string | undefined, page: number, limit: number) {
    const skip = (page - 1) * limit;

    if (role === 'organizer') {
      const [data, total] = await Promise.all([
        this.prisma.tournament.findMany({
          where: { organizerId: userId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.tournament.count({
          where: { organizerId: userId },
        }),
      ]);

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } else if (role === 'player') {
      const registrations = await this.prisma.registration.findMany({
        where: {
          OR: [
            { playerId: userId },
            { partnerId: userId },
          ],
        },
        select: { tournamentId: true },
      });

      const tournamentIds = Array.from(new Set(registrations.map((r) => r.tournamentId)));

      const [data, total] = await Promise.all([
        this.prisma.tournament.findMany({
          where: { id: { in: tournamentIds } },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.tournament.count({
          where: { id: { in: tournamentIds } },
        }),
      ]);

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } else if (!role) {
      // Get all registrations where the user participates
      const registrations = await this.prisma.registration.findMany({
        where: {
          OR: [
            { playerId: userId },
            { partnerId: userId },
          ],
        },
        select: { tournamentId: true },
      });

      const participatedIds = Array.from(new Set(registrations.map((r) => r.tournamentId)));

      const [data, total] = await Promise.all([
        this.prisma.tournament.findMany({
          where: {
            OR: [
              { organizerId: userId },
              { id: { in: participatedIds } },
            ],
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.tournament.count({
          where: {
            OR: [
              { organizerId: userId },
              { id: { in: participatedIds } },
            ],
          },
        }),
      ]);

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } else {
      throw new BadRequestException('Invalid role. Must be organizer or player');
    }
  }

  async findAll(page: number, limit: number, status?: TournamentStatus, search?: string) {
    const skip = (page - 1) * limit;
    const filter: any = {};
    if (status) {
      if (status === TournamentStatus.draft) {
        throw new ForbiddenException('Cannot query draft tournaments publicly.');
      }
      filter.status = status;
    } else {
      filter.status = {
        in: [
          TournamentStatus.published,
          TournamentStatus.open_registration,
          TournamentStatus.closed_registration,
          TournamentStatus.in_progress,
        ],
      };
    }
    if (search) {
      filter.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { venue: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where: filter,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tournament.count({ where: filter }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: { events: true },
    });
    if (!tournament) throw new NotFoundException(`Tournament with ID ${id} not found`);

    const approvedRegistrations = await this.prisma.registration.findMany({
      where: {
        tournamentId: id,
        status: 'approved',
      },
      select: {
        playerId: true,
        partnerId: true,
      },
    });

    const participantCount = approvedRegistrations.reduce((acc, reg) => {
      return acc + 1 + (reg.partnerId ? 1 : 0);
    }, 0);

    return {
      ...tournament,
      participantCount,
    };
  }

  async update(id: number, updateTournamentDto: UpdateTournamentDto) {
    const existing = await this.findOne(id);

    if (existing.status === TournamentStatus.completed) {
      throw new BadRequestException('Cannot update a completed tournament');
    }

    const nextStartDate = updateTournamentDto.startDate ? new Date(updateTournamentDto.startDate) : existing.startDate;
    const nextEndDate = updateTournamentDto.endDate ? new Date(updateTournamentDto.endDate) : existing.endDate;

    if (nextStartDate > nextEndDate) {
      throw new BadRequestException('startDate cannot be after endDate');
    }

    const nextRegStartDate = updateTournamentDto.registrationStartDate !== undefined
      ? (updateTournamentDto.registrationStartDate ? new Date(updateTournamentDto.registrationStartDate) : null)
      : existing.registrationStartDate;

    const nextRegEndDate = updateTournamentDto.registrationEndDate !== undefined
      ? (updateTournamentDto.registrationEndDate ? new Date(updateTournamentDto.registrationEndDate) : null)
      : existing.registrationEndDate;

    if (nextRegStartDate && nextRegEndDate && nextRegStartDate > nextRegEndDate) {
      throw new BadRequestException('registrationStartDate cannot be after registrationEndDate');
    }
    if (nextRegEndDate && nextRegEndDate > nextStartDate) {
      throw new BadRequestException('registrationEndDate cannot be after startDate');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tournament.update({
        where: { id },
        data: {
          ...updateTournamentDto,
          startDate: updateTournamentDto.startDate ? new Date(updateTournamentDto.startDate) : undefined,
          endDate: updateTournamentDto.endDate ? new Date(updateTournamentDto.endDate) : undefined,
          registrationStartDate: updateTournamentDto.registrationStartDate !== undefined
            ? (updateTournamentDto.registrationStartDate ? new Date(updateTournamentDto.registrationStartDate) : null)
            : undefined,
          registrationEndDate: updateTournamentDto.registrationEndDate !== undefined
            ? (updateTournamentDto.registrationEndDate ? new Date(updateTournamentDto.registrationEndDate) : null)
            : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          tournamentId: id,
          action: 'INFO_UPDATE',
          oldValue: existing as any,
          newValue: updated as any,
        },
      });

      // Invalidate poster cache on metadata updates
      if (
        updateTournamentDto.name ||
        updateTournamentDto.startDate ||
        updateTournamentDto.venue
      ) {
        await tx.tournamentPoster.deleteMany({
          where: { tournamentId: id },
        });
      }

      return updated;
    });
  }

  async updateStatus(id: number, updateStatusDto: UpdateTournamentStatusDto) {
    const existing = await this.findOne(id);

    const validTransitions: Record<TournamentStatus, TournamentStatus[]> = {
      [TournamentStatus.draft]: [TournamentStatus.published],
      [TournamentStatus.published]: [TournamentStatus.draft, TournamentStatus.open_registration],
      [TournamentStatus.open_registration]: [TournamentStatus.closed_registration, TournamentStatus.in_progress, TournamentStatus.published],
      [TournamentStatus.closed_registration]: [TournamentStatus.in_progress, TournamentStatus.open_registration, TournamentStatus.published],
      [TournamentStatus.in_progress]: [TournamentStatus.completed],
      [TournamentStatus.completed]: [],
    };

    const allowed = validTransitions[existing.status] || [];
    if (!allowed.includes(updateStatusDto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${existing.status} to ${updateStatusDto.status}`,
      );
    }

    // 1. draft to published: host must setup all the information before publishing (event, prize, payment, sponsor)
    if (existing.status === TournamentStatus.draft && updateStatusDto.status === TournamentStatus.published) {
      const eventCount = await this.prisma.tournamentEvent.count({ where: { tournamentId: id } });
      if (eventCount === 0) {
        throw new BadRequestException('Tournament must have at least one event category before publishing.');
      }

      const prizeCount = await this.prisma.prize.count({ where: { tournamentId: id } });
      if (prizeCount === 0) {
        throw new BadRequestException('Tournament must have at least one prize configured before publishing.');
      }

      const sponsorCount = await this.prisma.sponsor.count({ where: { tournamentId: id } });
      if (sponsorCount === 0) {
        throw new BadRequestException('Tournament must have at least one sponsor added before publishing.');
      }

      if (!existing.paymentBankName || !existing.paymentAccountName || !existing.paymentAccountNumber) {
        throw new BadRequestException(
          'Tournament must have payment transfer details (bank name, account name, and account number) configured before publishing.',
        );
      }
    }

    // 2. published to open_registration: wait to the open registration date
    if (updateStatusDto.status === TournamentStatus.open_registration) {
      if (!existing.registrationStartDate) {
        throw new BadRequestException('Registration start date is not configured.');
      }
      if (new Date() < new Date(existing.registrationStartDate)) {
        throw new BadRequestException('Cannot open registration: the registration start date has not been reached yet.');
      }
    }

    // 3. open_registration to closed_registration: wait to the close registration date
    if (updateStatusDto.status === TournamentStatus.closed_registration) {
      if (!existing.registrationEndDate) {
        throw new BadRequestException('Registration end date is not configured.');
      }
      if (new Date() < new Date(existing.registrationEndDate)) {
        throw new BadRequestException('Cannot close registration: the registration end date has not been reached yet.');
      }
    }

    // 4. closed_registration to in_progress: wait to the tournament start date, set up seeding, group stage, schedule
    if (existing.status === TournamentStatus.closed_registration && updateStatusDto.status === TournamentStatus.in_progress) {
      if (new Date() < new Date(existing.startDate)) {
        throw new BadRequestException('Cannot start tournament: the tournament start date has not been reached yet.');
      }

      const events = await this.prisma.tournamentEvent.findMany({ where: { tournamentId: id } });
      if (events.length === 0) {
        throw new BadRequestException('Tournament has no events configured.');
      }

      for (const event of events) {
        const teamCount = await this.prisma.team.count({ where: { eventId: event.id } });
        if (teamCount > 0) {
          // Check seeding
          const seedCount = await this.prisma.seed.count({ where: { eventId: event.id } });
          if (seedCount !== teamCount) {
            throw new BadRequestException(`Seeding has not been generated for all teams in event category ${event.name}.`);
          }
          const unlockedSeedCount = await this.prisma.seed.count({ where: { eventId: event.id, status: { not: 'locked' } } });
          if (unlockedSeedCount > 0) {
            throw new BadRequestException(`Seeding must be locked for event category ${event.name}.`);
          }

          // Check group stage
          const groupCount = await this.prisma.groupStageGroup.count({ where: { eventId: event.id } });
          if (groupCount === 0) {
            throw new BadRequestException(`Groups have not been drawn for event category ${event.name}.`);
          }

          // Check matches (schedule)
          const matchCount = await this.prisma.match.count({ where: { eventId: event.id } });
          if (matchCount === 0) {
            throw new BadRequestException(`Matches have not been generated for event category ${event.name}.`);
          }
          const unscheduledMatchCount = await this.prisma.match.count({
            where: {
              eventId: event.id,
              groupStage: true,
              OR: [{ bookingId: null }, { bookingItemId: null }],
            },
          });
          if (unscheduledMatchCount > 0) {
            throw new BadRequestException(`Some group stage matches in event category ${event.name} have not been scheduled.`);
          }
        }
      }
    }

    // 5. in_progress to completed: wait to all matches completed
    if (updateStatusDto.status === TournamentStatus.completed) {
      const pendingMatches = await this.prisma.match.count({
        where: {
          tournamentId: id,
          status: { notIn: [MatchStatus.completed, MatchStatus.walkover] },
        },
      });
      if (pendingMatches > 0) {
        throw new BadRequestException('Cannot complete tournament: there are still matches in progress or scheduled.');
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tournament.update({
        where: { id },
        data: { status: updateStatusDto.status },
      });

      await tx.auditLog.create({
        data: {
          tournamentId: id,
          action: 'STATUS_CHANGE',
          oldValue: { status: existing.status },
          newValue: { status: updated.status },
        },
      });

      return updated;
    });

    // Fire-and-forget tournament completed notification
    if (updateStatusDto.status === TournamentStatus.completed) {
      void this.handleTournamentCompletedNotification(id, result.name);
    }

    return result;
  }

  private async handleTournamentCompletedNotification(tournamentId: number, tournamentName: string) {
    try {
      // Gather all approved registrations to get VĐV IDs
      const registrations = await this.prisma.registration.findMany({
        where: { tournamentId, status: 'approved' },
        select: { playerId: true, partnerId: true },
      });

      const playerIds = new Set<string>();
      for (const reg of registrations) {
        if (reg.playerId) playerIds.add(reg.playerId);
        if (reg.partnerId) playerIds.add(reg.partnerId);
      }

      const actionUrl = `${this.notificationClient.frontendUrl}/tournaments/${tournamentId}`;

      // Send email
      for (const playerId of playerIds) {
        const email = await this.notificationClient.getUserEmail(playerId);
        if (!email) continue;

        void this.notificationClient.sendEmail(
          email,
          'tournament_completed',
          {
            playerName: 'Vận động viên',
            tournamentName,
            actionUrl,
          }
        );
      }

      // Send In-app Notifications
      if (playerIds.size > 0) {
        await this.notificationClient.sendInAppNotification(
          Array.from(playerIds),
          '🏆 Giải đấu đã kết thúc',
          `Giải đấu ${tournamentName} đã chính thức khép lại. Hãy xem bảng xếp hạng và kết quả chung cuộc!`
        );
      }
    } catch (err) {
      this.logger.error(`Failed to handle tournament completed notification: ${err}`);
    }
  }

  async remove(id: number) {
    const existing = await this.findOne(id);

    if (existing.status === TournamentStatus.in_progress || existing.status === TournamentStatus.completed) {
      throw new BadRequestException(`Cannot delete a tournament that is ${existing.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          tournamentId: id,
          action: 'TOURNAMENT_DELETE',
          oldValue: existing as any,
        },
      });

      return tx.tournament.delete({
        where: { id },
      });
    });
  }

  async queryPlayerTournamentsAndMatches(userId: string, startDate?: string, endDate?: string) {
    // 1. Get all registrations of the user that are approved
    const registrations = await this.prisma.registration.findMany({
      where: {
        OR: [
          { playerId: userId },
          { partnerId: userId },
        ],
        status: 'approved',
      },
      select: {
        tournamentId: true,
      },
    });

    const tournamentIds = Array.from(new Set(registrations.map(r => r.tournamentId)));

    // 2. Fetch the corresponding tournaments (either registered or organized)
    const tournamentWhere: any = {
      OR: [
        { id: { in: tournamentIds } },
        { organizerId: userId },
      ],
      status: { not: 'draft' }, // Exclude draft tournaments
    };

    if (startDate || endDate) {
      tournamentWhere.startDate = {};
      if (startDate) tournamentWhere.startDate.gte = new Date(startDate);
      if (endDate) tournamentWhere.startDate.lte = new Date(endDate);
    }

    const tournaments = await this.prisma.tournament.findMany({
      where: tournamentWhere,
      orderBy: { startDate: 'asc' },
    });

    // 3. Find the user's teams in these tournaments
    const teams = await this.prisma.team.findMany({
      where: {
        OR: [
          { player1Id: userId },
          { player2Id: userId },
        ],
      },
      select: {
        id: true,
      },
    });

    const teamIds = teams.map(t => t.id);

    // 4. Find matches for these teams
    const matchWhere: any = {
      OR: [
        { team1Id: { in: teamIds } },
        { team2Id: { in: teamIds } },
        { refereeId: userId },
      ],
    };

    if (startDate || endDate) {
      matchWhere.time = {};
      if (startDate) matchWhere.time.gte = new Date(startDate);
      if (endDate) matchWhere.time.lte = new Date(endDate);
    }

    const matches = await this.prisma.match.findMany({
      where: matchWhere,
      orderBy: { time: 'asc' },
      include: {
        tournament: true,
        event: true,
        team1: true,
        team2: true,
      },
    });

    return {
      tournaments,
      matches,
    };
  }

  async findAuditLogs(tournamentId: number) {
    const tournament = await this.prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    return this.prisma.auditLog.findMany({
      where: { tournamentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUuid(uuid: string) {
    return this.prisma.tournament.findUnique({
      where: { uuid },
    });
  }

  async checkChatAccess(tournamentUuid: string, userId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { uuid: tournamentUuid },
      include: {
        events: { select: { capacity: true } },
        registrations: {
          where: {
            status: 'approved',
            OR: [{ playerId: userId }, { partnerId: userId }],
          },
          select: { id: true },
          take: 1,
        },
        referees: {
          where: { refereeId: userId },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    const isOrganizer = tournament.organizerId === userId;
    const isApprovedPlayer = tournament.registrations.length > 0;
    const isReferee = tournament.referees.length > 0;

    if (!isOrganizer && !isApprovedPlayer && !isReferee) {
      throw new ForbiddenException('User is not allowed to access this tournament chat');
    }

    const capacity = tournament.events.reduce((total, event) => total + event.capacity, 0);

    return {
      canAccess: true,
      role: isOrganizer ? 'ORGANIZER' : isReferee ? 'REFEREE' : 'PLAYER',
      tournament: {
        id: tournament.uuid,
        name: tournament.name,
        status: tournament.status,
        organizerId: tournament.organizerId,
        registered: tournament.registered,
        capacity,
      },
    };
  }

  syncTournamentChat(tournamentId: number): void {
    this.prisma.tournament
      .findUnique({
        where: { id: tournamentId },
        select: {
          uuid: true,
          organizerId: true,
          registrations: {
            where: { status: 'approved' },
            select: { playerId: true, partnerId: true },
          },
          referees: {
            select: { refereeId: true },
          },
        },
      })
      .then((tournament) => {
        if (!tournament) return;

        const memberIds = new Set<string>();
        if (tournament.organizerId) memberIds.add(tournament.organizerId);
        for (const registration of tournament.registrations) {
          if (registration.playerId) memberIds.add(registration.playerId);
          if (registration.partnerId) memberIds.add(registration.partnerId);
        }
        for (const referee of tournament.referees) {
          if (referee.refereeId) memberIds.add(referee.refereeId);
        }

        this.chatClient.syncTournamentChat(tournament.uuid, Array.from(memberIds));
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to fetch members for tournament chat sync tournamentId=${tournamentId}: ${(error as Error)?.message ?? error}`,
        );
      });
  }

  async discover(query: DiscoverTournamentsDto, authHeader?: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    // Build standard Prisma filters
    const where: any = {};

    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { venue: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      if (query.status === TournamentStatus.draft) {
        throw new ForbiddenException('Cannot query draft tournaments publicly.');
      }
      where.status = query.status;
    } else {
      // By default show visible tournaments (published, open_registration, in_progress)
      where.status = { in: ['published', 'open_registration', 'in_progress'] };
    }

    if (query.upcoming) {
      where.startDate = { gte: new Date() };
    }

    // Decode user info if auth header exists
    let userId: string | undefined;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.decode(token) as any;
        userId = decoded?.sub || decoded?.userId;
      } catch (e) {
        // Ignore decoding errors
      }
    }

    // Fetch tournaments matching filters
    const tournaments = await this.prisma.tournament.findMany({
      where,
      include: {
        events: true,
        registrations: {
          select: {
            playerId: true,
            partnerId: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    if (userId) {
      try {
        // Authenticated flow
        // 1. Fetch user profile
        const userProfile = await this.userClient.getUserProfile(userId);

        // 2. Fetch user's favorite sports centers
        let favoriteCenterIds: string[] = [];
        try {
          const favRes = await this.sportCenterClient.getCenter('favourites/me', authHeader);
          if (favRes && Array.isArray(favRes.data)) {
            favoriteCenterIds = favRes.data.map((c: any) => c.id);
          }
        } catch (e) {
          // Ignore errors from external service, fail gracefully
        }


        // 4. Calculate personalized score for each tournament
        const scoredTournaments = tournaments.map((t) => {
          let score = 0;
          const matchingEvents: number[] = [];

          // Base status match
          if (t.status === 'open_registration') {
            score += 100;
          } else if (t.status === 'published') {
            score += 50;
          }

          // Proximity/Location match
          let locationMatched = false;
          const userLat = userProfile?.latitude ? Number(userProfile.latitude) : null;
          const userLon = userProfile?.longitude ? Number(userProfile.longitude) : null;
          const tLat = t.latitude ? Number(t.latitude) : null;
          const tLon = t.longitude ? Number(t.longitude) : null;

          if (userLat !== null && userLon !== null && tLat !== null && tLon !== null) {
            const distance = this.calculateDistance(userLat, userLon, tLat, tLon);
            if (distance <= 15) {
              score += 150;
              locationMatched = true;
            } else if (distance <= 50) {
              score += 100;
              locationMatched = true;
            } else if (distance <= 100) {
              score += 50;
              locationMatched = true;
            }
          }

          if (!locationMatched && userProfile?.address && t.venue) {
            const cities = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Bình Dương', 'Đồng Nai', 'Vũng Tàu', 'Nha Trang'];
            const userCity = cities.find(city => userProfile.address.toLowerCase().includes(city.toLowerCase()));
            if (userCity && t.venue.toLowerCase().includes(userCity.toLowerCase())) {
              score += 150;
            }
          }

          // Favorite centers match
          if (t.centerIds && t.centerIds.some(cid => favoriteCenterIds.includes(cid))) {
            score += 200;
          }


          // Skill range & Gender matches
          const userRating = userProfile?.duprProfile?.rating || userProfile?.duprProfile?.doublesRating || userProfile?.selfRating || 2.5;
          const userGender = userProfile?.gender || 'OTHER';

          for (const event of t.events) {
            let skillMatched = false;
            let genderMatched = false;

            // Skill range parsing
            const skillRange = event.skillRange.toUpperCase();
            if (skillRange === 'ANY') {
              skillMatched = true;
            } else if (skillRange.includes('-')) {
              const parts = skillRange.split('-');
              const min = parseFloat(parts[0]);
              const max = parseFloat(parts[1]);
              if (!isNaN(min) && !isNaN(max) && userRating >= min && userRating <= max) {
                skillMatched = true;
              }
            } else if (skillRange.includes('+')) {
              const min = parseFloat(skillRange.replace('+', ''));
              if (!isNaN(min) && userRating >= min) {
                skillMatched = true;
              }
            } else {
              const val = parseFloat(skillRange);
              if (!isNaN(val) && Math.abs(userRating - val) <= 0.25) {
                skillMatched = true;
              }
            }

            // Gender parsing
            const eventGender = event.gender.toUpperCase();
            if (eventGender === 'ANY' || eventGender === 'MIXED') {
              genderMatched = true;
            } else if (eventGender === userGender) {
              genderMatched = true;
            }

            if (skillMatched && genderMatched) {
              matchingEvents.push(event.id);
            }
          }

          if (matchingEvents.length > 0) {
            score += 80;
          }

          const { registrations, ...tournamentData } = t;

          return {
            ...tournamentData,
            personalizedScore: score,
            matchingEvents,
          };
        });

        // Sort by personalized score desc, then startDate asc
        scoredTournaments.sort((a, b) => {
          if (b.personalizedScore !== a.personalizedScore) {
            return b.personalizedScore - a.personalizedScore;
          }
          return a.startDate.getTime() - b.startDate.getTime();
        });

        const paginated = scoredTournaments.slice(skip, skip + limit);

        return {
          data: paginated,
          meta: {
            total: scoredTournaments.length,
            page,
            limit,
            totalPages: Math.ceil(scoredTournaments.length / limit),
          },
        };
      } catch (error) {
        this.logger.error(`Error calculating tournament personalization: ${error instanceof Error ? error.message : error}`, error instanceof Error ? error.stack : undefined);
      }
    }

    // Guest / Fallback flow
    const statusPriority: Record<string, number> = {
      open_registration: 1,
      published: 2,
      in_progress: 3,
    };

    const sortedTournaments = [...tournaments].sort((a, b) => {
      const priorityA = statusPriority[a.status] ?? 99;
      const priorityB = statusPriority[b.status] ?? 99;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return a.startDate.getTime() - b.startDate.getTime();
    });

    const paginated = sortedTournaments.slice(skip, skip + limit);

    return {
      data: paginated.map(t => {
        const { registrations, ...rest } = t;
        return {
          ...rest,
          personalizedScore: null,
          matchingEvents: [],
        };
      }),
      meta: {
        total: tournaments.length,
        page,
        limit,
        totalPages: Math.ceil(tournaments.length / limit),
      },
    };
  }

  async getShareLink(id: number, source = 'user_share', medium = 'native_share') {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${id} not found`);
    }
    const frontendUrl = process.env.FRONTEND_URL || 'https://picklehub.vn';
    const shareUrl = `${frontendUrl}/tournaments/${id}?utm_source=${source}&utm_medium=${medium}`;
    return { shareUrl };
  }

  async getPoster(id: number): Promise<{ type: 'redirect'; url: string } | { type: 'buffer'; buffer: Buffer }> {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
    });
    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${id} not found`);
    }

    if (tournament.status === 'draft') {
      throw new ForbiddenException('Posters are not available for draft tournaments');
    }

    const currentHash = this.posterService.generateMetadataHash(
      tournament.name,
      tournament.startDate,
      tournament.venue
    );

    const cachedPoster = await this.prisma.tournamentPoster.findUnique({
      where: { tournamentId: id },
    });

    if (
      cachedPoster &&
      cachedPoster.metadataHash === currentHash &&
      !cachedPoster.imageUrl.includes('v12345/posters')
    ) {
      return { type: 'redirect', url: cachedPoster.imageUrl };
    }

    const buffer = await this.posterService.generatePoster(tournament);
    const fileName = `tournament_${id}_poster.png`;
    const imageUrl = await this.posterService.uploadPoster(buffer, fileName);

    await this.prisma.tournamentPoster.upsert({
      where: { tournamentId: id },
      create: {
        tournamentId: id,
        imageUrl,
        metadataHash: currentHash,
      },
      update: {
        imageUrl,
        metadataHash: currentHash,
      },
    });

    return { type: 'buffer', buffer };
  }
}
