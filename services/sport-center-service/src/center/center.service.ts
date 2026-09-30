import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCenterDto, SportCenterStatusDto } from './dto/create-center.dto';
import { ListCenterQueryDto } from './dto/list-center-query.dto';
import { UpdateCenterDto } from './dto/update-center.dto';
import { CreateCenterPriceSlotDto } from './dto/create-center-price-slot.dto';
import { UpdateCenterPriceSlotsDto } from './dto/update-center-price-slots.dto';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config/dist/config.service';
import { ListCustomersQueryDto } from '../customer/dto/list-customers-query.dto';
import { GeocodingService } from '../geocoding/geocoding.service';

export interface PlayerInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

type OwnedCenterRef = {
  id: string;
  name: string;
};

type CustomerCenterSummary = {
  centerId: string;
  centerName: string;
  visitCount: number;
  totalSpend: number;
  cancelledVisitCount: number;
  cancelledSpend: number;
  lastVisitAt: Date | null;
};

type CustomerAggregate = {
  customerId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  phoneNumber: string | null;
  phoneNumbers: Set<string>;
  nameCandidates: Set<string>;
  emailCandidates: Set<string>;
  centerIds: Set<string>;
  visitCount: number;
  completedVisitCount: number;
  confirmedVisitCount: number;
  pendingVisitCount: number;
  cancelledVisitCount: number;
  totalSpend: number;
  cancelledSpend: number;
  firstVisitAt: Date | null;
  lastVisitAt: Date | null;
  latestBookingAt: Date | null;
  latestBooking: any | null;
  byCenter: Map<string, CustomerCenterSummary>;
  totalCreditBalance: number;
};

type CustomerListItem = {
  customer: {
    id: string;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    phoneNumber: string | null;
  };
  summary: {
    visitCount: number;
    completedVisitCount: number;
    confirmedVisitCount: number;
    pendingVisitCount: number;
    cancelledVisitCount: number;
    totalSpend: number;
    cancelledSpend: number;
    creditBalance: number;
    firstVisitAt: Date | null;
    lastVisitAt: Date | null;
    centerCount: number;
  };
  centers: CustomerCenterSummary[];
  latestBooking: any | null;
};

@Injectable()
export class CenterService {
  private readonly logger = new Logger(CenterService.name);
  private readonly authServiceUrl: string;
  private readonly authInternalToken: string;
  private readonly userServiceUrl: string;
  private readonly internalBearerToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly geocodingService: GeocodingService,
  ) {
    this.authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://auth-service:8001';
    this.authInternalToken = this.configService.get<string>('SERVICE_INTERNAL_TOKEN') || '';
    this.userServiceUrl = this.configService.get<string>('USER_SERVICE_URL') || 'http://user-service:8006';
    this.internalBearerToken = this.configService.get<string>('SERVICE_INTERNAL_TOKEN') || '';
  }

  private async fetchUserProfile(userId: string): Promise<{ latitude: number | null, longitude: number | null, city: string | null } | null> {
    try {
      const url = `${this.userServiceUrl}/api/users/internal/batch`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service-token': this.internalBearerToken,
        },
        body: JSON.stringify({ userIds: [userId] }),
      });

      if (!response.ok) {
        this.logger.warn(`Failed to fetch user profile from user service: ${response.statusText}`);
        return null;
      }

      const profiles = await response.json();
      if (Array.isArray(profiles) && profiles.length > 0) {
        return profiles[0];
      }
      return null;
    } catch (error) {
      this.logger.warn(`Error fetching user profile: ${error}`);
      return null;
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

  private toNumber(value: Prisma.Decimal | number | string | null | undefined) {
    return Number(value ?? 0);
  }

  private async fetchPlayerDetails(userIds: string[]): Promise<Map<string, PlayerInfo>> {
    if (userIds.length === 0) return new Map();

    const uniqueIds = Array.from(new Set(userIds));

    try {
      const url = `${this.authServiceUrl}/api/auth/internal/users/batch`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': this.authInternalToken,
        },
        body: JSON.stringify({ userIds: uniqueIds }),
      });

      if (!response.ok) {
        this.logger.warn(`Failed to fetch customer profiles from auth service: ${response.statusText}`);
        return new Map();
      }

      const users: PlayerInfo[] = await response.json();
      const customerMap = new Map<string, PlayerInfo>();
      users.forEach(user => customerMap.set(user.id, user));
      return customerMap;
    } catch (error) {
      this.logger.warn(`Error fetching customer profiles: ${error}`);
      return new Map();
    }
  }

  private async resolveOwnedCenters(ownerId: string, centerId?: string): Promise<OwnedCenterRef[]> {
    if (centerId) {
      const center = await this.prisma.sportCenter.findFirst({
        where: this.notDeleted({ id: centerId, ownerId }),
        select: { id: true, name: true },
      });

      if (!center) {
        throw new NotFoundException('Sport center not found');
      }

      return [center];
    }

    return this.prisma.sportCenter.findMany({
      where: this.notDeleted({ ownerId }),
      select: { id: true, name: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private isWithinDateRange(date: Date | null, from?: string, to?: string) {
    if (!date) return false;

    const target = date.getTime();
    if (from) {
      const fromDate = new Date(from);
      if (target < fromDate.getTime()) return false;
    }

    if (to) {
      const toDate = new Date(to);
      toDate.setUTCDate(toDate.getUTCDate() + 1);
      if (target >= toDate.getTime()) return false;
    }

    return true;
  }

  private isWithinSpendRange(spend: number, minSpend?: number, maxSpend?: number) {
    if (minSpend !== undefined && spend < minSpend) return false;
    if (maxSpend !== undefined && spend > maxSpend) return false;
    return true;
  }

  // helper function to check center is not deleted and exists.
  private notDeleted<T>(where: T): T & { deletedAt: null } {
    return { ...where, deletedAt: null };
  }

  private async addReviewStatsToList(items: any[]) {
    if (items.length === 0) return items;

    const centerIds = items.map((item) => item.id);
    const stats = await this.prisma.review.groupBy({
      by: ['centerId'],
      _avg: {
        rating: true,
      },
      _count: {
        id: true,
      },
      where: {
        centerId: { in: centerIds },
      },
    });

    const statsMap = new Map(
      stats.map((s) => [
        s.centerId,
        {
          averageRating: s._avg.rating ? parseFloat(s._avg.rating.toFixed(1)) : 0,
          reviewCount: s._count.id,
        },
      ]),
    );

    return items.map((item) => ({
      ...item,
      averageRating: statsMap.get(item.id)?.averageRating ?? 0,
      reviewCount: statsMap.get(item.id)?.reviewCount ?? 0,
    }));
  }

  private async addFavouriteFlagsToList(items: any[], userId: string) {
    if (items.length === 0) return items;

    const centerIds = items.map((item) => item.id);
    const favourites = await this.prisma.favourite.findMany({
      where: {
        userId,
        centerId: { in: centerIds },
      },
      select: { centerId: true },
    });

    const favouriteCenterIds = new Set(favourites.map((favourite) => favourite.centerId));

    return items.map((item) => ({
      ...item,
      isFavourite: favouriteCenterIds.has(item.id),
    }));
  }

  private async addFavouriteFlag(item: any, userId: string) {
    const favourite = await this.prisma.favourite.findUnique({
      where: {
        userId_centerId: {
          userId,
          centerId: item.id,
        },
      },
      select: { id: true },
    });

    return {
      ...item,
      isFavourite: !!favourite,
    };
  }

  /**
   * Creates a new sport center aggregate.
   * Business context is explicit from the endpoint and DTO payload.
   */
  async create(ownerId: string, createCenterDto: CreateCenterDto) {
    const trimmedName = createCenterDto.name.trim();

    // check if owner already has a center with the same name to prevent duplicates (case-insensitive)
    const existingNameCenterCount = await this.prisma.sportCenter.count({
      where: this.notDeleted({
        ownerId: ownerId,
        name: { equals: trimmedName, mode: 'insensitive' },
      }),
    });

    // if there is already a center with the same name for the owner
    if (existingNameCenterCount > 0) {
      throw new ConflictException('Owner already has a sport center with this name');
    }

    // check if owner has reached the maximum number of centers allowed per owner
    const existingCount = await this.prisma.sportCenter.count({
      where: this.notDeleted({
        ownerId: ownerId,
      }),
    });

    const maxCenters = this.configService.get<number>('MAX_SPORT_CENTERS_PER_OWNER', 5);
    if (existingCount >= maxCenters) {
      throw new BadRequestException(`Owner can only have up to ${maxCenters} sport centers`);
    }

    // resolve coordinates
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (createCenterDto.address) {
      try {
        const geoResult = await this.geocodingService.geocode(createCenterDto.address);
        latitude = geoResult.latitude;
        longitude = geoResult.longitude;
      } catch (err) {
        this.logger.warn(`Failed to resolve coordinates on create: ${err}`);
      }
    }

    // create the center
    try {
      // Persist a new center with explicit lifecycle defaults.
      return this.prisma.sportCenter.create({
        data: {
          ownerId: ownerId,
          name: trimmedName,
          address: createCenterDto.address,
          latitude: latitude,
          longitude: longitude,
          phone: createCenterDto.phone,
          openTime: createCenterDto.openTime,
          closeTime: createCenterDto.closeTime,
          basePrice: createCenterDto.basePrice,
          status: createCenterDto.status ?? SportCenterStatusDto.INACTIVE,
          email: createCenterDto.email,
          description: createCenterDto.description,
          images: createCenterDto.images ?? [],
          rules: createCenterDto.rules ?? [],
          amenities: createCenterDto.amenities ?? [],
          // Payment info — required fields for players to know how to pay
          paymentAccountName: createCenterDto.paymentAccountName,
          paymentAccountNumber: createCenterDto.paymentAccountNumber,
          paymentBankName: createCenterDto.paymentBankName,
          paymentQrUrl: createCenterDto.paymentQrUrl,
        },
      });
    } catch (error) {
      // Handle unique constraint violation for ownerId + name.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Owner already has a sport center with this name');
      }
      throw error;
    }

  }

  /**
   * Lists ACTIVE sport centers with limit/offset pagination for users.
   */
  async findActive(query: ListCenterQueryDto, userId: string) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    // Build filtering criteria from query params only.
    let where: any = query.status ? { status: query.status } : {};

    if (query.keyword) {
      where = {
        ...where,
        OR: [
          { name: { contains: query.keyword, mode: 'insensitive' } },
          { address: { contains: query.keyword, mode: 'insensitive' } },
        ],
      };
    }

    // If favouritesOnly is true, filter to only favourited centers by user
    if (query.favouritesOnly) {
      // Get all favourite center IDs for the user
      const favourites = await this.prisma.favourite.findMany({
        where: { userId },
        select: { centerId: true },
      });
      const centerIds = favourites.map(fav => fav.centerId);
      if (centerIds.length === 0) {
        return {
          data: [],
          pagination: {
            limit,
            offset,
            total: 0,
          },
        };
      }
      where = {
        ...where,
        id: { in: centerIds },
      };
    }

    let userLat = query.latitude;
    let userLon = query.longitude;

    if (userLat === undefined || userLon === undefined) {
      const profile = await this.fetchUserProfile(userId);
      if (profile && profile.latitude !== null && profile.longitude !== null) {
        userLat = profile.latitude;
        userLon = profile.longitude;
      }
    }

    const hasCoords = userLat !== undefined && userLon !== undefined;

    if (hasCoords) {
      try {
        const allItems = await this.prisma.sportCenter.findMany({
          where: this.notDeleted({ ...where, status: 'ACTIVE' }),
          include: {
            _count: { select: { courts: true } },
            services: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
            products: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
          },
        });

        const itemsWithStats = await this.addReviewStatsToList(allItems);
        const itemsWithStatsAndFavouriteFlag = await this.addFavouriteFlagsToList(itemsWithStats, userId);

        const enriched = itemsWithStatsAndFavouriteFlag.map(item => {
          const lat = item.latitude !== null ? Number(item.latitude) : null;
          const lon = item.longitude !== null ? Number(item.longitude) : null;
          const distance = (lat !== null && lon !== null && userLat !== undefined && userLon !== undefined)
            ? parseFloat(this.haversineDistance(userLat, userLon, lat, lon).toFixed(2))
            : null;
          return {
            ...item,
            distance,
          };
        });

        enriched.sort((a, b) => {
          if (a.distance === null && b.distance === null) return 0;
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });

        const total = enriched.length;
        const paginatedData = enriched.slice(offset, offset + limit);

        return {
          data: paginatedData,
          pagination: {
            limit,
            offset,
            total,
          },
        };
      } catch (error) {
        this.logger.error(`Error calculating proximity scores for sport centers: ${error instanceof Error ? error.message : error}`, error instanceof Error ? error.stack : undefined);
      }
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.sportCenter.findMany({
        where: this.notDeleted({ ...where, status: 'ACTIVE' }),
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { courts: true } },
          services: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
          products: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
        },
      }),
      this.prisma.sportCenter.count({ where: this.notDeleted({ ...where, status: 'ACTIVE' }) }),
    ]);

    const itemsWithStats = await this.addReviewStatsToList(items);
    const itemsWithStatsAndFavouriteFlag = await this.addFavouriteFlagsToList(itemsWithStats, userId);

    const enriched = itemsWithStatsAndFavouriteFlag.map(item => ({
      ...item,
      distance: null,
    }));

    return {
      data: enriched,
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }


  /**
  * Lists ALL sport centers for ADMIN.
  */
  async findAll(query: ListCenterQueryDto) {
    // Build filtering criteria from query params only.
    const where = query.status ? { status: query.status } : {};

    // Fetch page data and total count in one transaction for consistency.
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sportCenter.findMany({
        where: this.notDeleted({ ...where }),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { courts: true } },
          services: { orderBy: { createdAt: 'desc' } },
          products: { orderBy: { createdAt: 'desc' } },
        },
      }),
      this.prisma.sportCenter.count({ where: this.notDeleted({ ...where }) }),
    ]);

    const itemsWithStats = await this.addReviewStatsToList(items);

    return {
      data: itemsWithStats,
      total: total,
    };
  }

  /**
   * finds centers by owner id.
   */
  async findByOwnerId(ownerId: string, userId: string) {
    // Query by ownerId field.
    const items = await this.prisma.sportCenter.findMany({
      where: this.notDeleted({ ownerId }),
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { courts: true } },
        services: { orderBy: { createdAt: 'desc' } },
        products: { orderBy: { createdAt: 'desc' } },
      },
    });
    const itemsWithStats = await this.addReviewStatsToList(items);
    return this.addFavouriteFlagsToList(itemsWithStats, userId);
  }

  /**
   * Retrieves center details by id.
   */
  async findOne(centerId: string, userId: string) {
    // Query by route-derived identifier.
    const center = await this.prisma.sportCenter.findFirst({
      where: this.notDeleted({ id: centerId }),
      include: {
        priceSlots: true,
        services: { orderBy: { createdAt: 'desc' } },
        products: { orderBy: { createdAt: 'desc' } },
        _count: { select: { courts: true } }
      },
    });

    if (!center) {
      throw new NotFoundException('Sport center not found');
    }

    const reviewStats = await this.prisma.review.aggregate({
      where: { centerId },
      _avg: { rating: true },
      _count: { id: true },
    });

    const centerWithStats = {
      ...center,
      averageRating: reviewStats._avg.rating ? parseFloat(reviewStats._avg.rating.toFixed(1)) : 0,
      reviewCount: reviewStats._count.id,
    };

    return this.addFavouriteFlag(centerWithStats, userId);
  }

  /**
   * Updates mutable fields of a center.
   */
  async update(centerId: string, updateCenterDto: UpdateCenterDto) {
    // Ensure target center exists before applying updates.
    const existingCenter = await this.prisma.sportCenter.findFirst({
      where: this.notDeleted({ id: centerId }),
      select: { id: true, ownerId: true },
    });

    if (!existingCenter) {
      throw new NotFoundException('Sport center not found');
    }

    // If name is being updated, check for duplicates
    if (updateCenterDto.name) {
      const trimmedName = updateCenterDto.name.trim();
      updateCenterDto.name = trimmedName;

      const duplicateCount = await this.prisma.sportCenter.count({
        where: this.notDeleted({
          ownerId: existingCenter.ownerId,
          name: { equals: trimmedName, mode: 'insensitive' },
          id: { not: centerId },
        }),
      });

      if (duplicateCount > 0) {
        throw new ConflictException('Owner already has another sport center with this name');
      }
    }

    // Resolve coordinates if address is updated
    let latitude: number | null | undefined = undefined;
    let longitude: number | null | undefined = undefined;
    if (updateCenterDto.address !== undefined) {
      if (updateCenterDto.address === null || updateCenterDto.address === '') {
        latitude = null;
        longitude = null;
      } else {
        try {
          const geoResult = await this.geocodingService.geocode(updateCenterDto.address);
          latitude = geoResult.latitude;
          longitude = geoResult.longitude;
        } catch (err) {
          this.logger.warn(`Failed to resolve coordinates on update: ${err}`);
        }
      }
    }

    // Apply partial updates from DTO.
    return this.prisma.sportCenter.update({
      where: { id: centerId },
      data: {
        ...updateCenterDto,
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
      },
    });
  }

  // Soft deletes a center by id.
  async remove(centerId: string) {
    // Ensure target center exists before deletion.
    const existingCenter = await this.prisma.sportCenter.findFirst({
      where: this.notDeleted({ id: centerId }),
      select: { id: true },
    });

    if (!existingCenter) {
      throw new NotFoundException('Sport center not found');
    }

    return this.prisma.sportCenter.update({
      where: { id: centerId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Adds a new price slot to a center
   */
  async createPriceSlot(centerId: string, dto: CreateCenterPriceSlotDto) {
    const center = await this.prisma.sportCenter.findFirst({
      where: this.notDeleted({ id: centerId }),
      select: { id: true },
    });

    if (!center) {
      throw new NotFoundException('Sport center not found');
    }

    const existingSlots = await this.prisma.centerPriceSlot.findMany({
      where: { centerId },
      orderBy: { startTime: 'asc' },
    });

    // Validate that the new slot doesn't overlap with existing slots
    const allSlots = [...existingSlots.map(s => ({ startTime: s.startTime, endTime: s.endTime, pricePerHour: Number(s.pricePerHour) })), dto];
    this.validateTimeSlots(allSlots);

    return this.prisma.centerPriceSlot.create({
      data: {
        centerId,
        startTime: dto.startTime,
        endTime: dto.endTime,
        pricePerHour: dto.pricePerHour,
      },
    });
  }

  /**
   * Deletes a price slot
   */
  async deletePriceSlot(centerId: string, slotId: string) {
    const priceSlot = await this.prisma.centerPriceSlot.findFirst({
      where: { id: slotId, centerId },
    });

    if (!priceSlot) {
      throw new NotFoundException('Price slot not found');
    }

    return this.prisma.centerPriceSlot.delete({
      where: { id: slotId },
    });
  }

  /**
   * Gets all price slots for a center
   */
  async getPriceSlots(centerId: string) {
    return this.prisma.centerPriceSlot.findMany({
      where: { centerId },
      orderBy: { startTime: 'asc' },
    });
  }

  private validateTimeSlots(slots: CreateCenterPriceSlotDto[]) {
    const timeToMinutes = (time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const parsedSlots = slots.map(slot => ({
      ...slot,
      start: timeToMinutes(slot.startTime),
      end: timeToMinutes(slot.endTime),
    }));

    // Check valid start and end times
    for (const slot of parsedSlots) {
      if (slot.start >= slot.end) {
        throw new BadRequestException(`Invalid time range: ${slot.startTime} - ${slot.endTime}. Start time must be before end time.`);
      }
    }

    // Sort by start time
    parsedSlots.sort((a, b) => a.start - b.start);

    // Check overlaps
    for (let i = 0; i < parsedSlots.length - 1; i++) {
      if (parsedSlots[i].end > parsedSlots[i + 1].start) {
        throw new BadRequestException(`Time slots overlap: ${parsedSlots[i].startTime}-${parsedSlots[i].endTime} and ${parsedSlots[i + 1].startTime}-${parsedSlots[i + 1].endTime}`);
      }
    }
  }

  /**
   * Updates all price slots for a center in bulk.
   * Price slots are optional overrides on top of basePrice.
   * Validates for no overlaps and no invalid time ranges.
   */
  async updatePriceSlots(centerId: string, dto: UpdateCenterPriceSlotsDto) {
    const center = await this.prisma.sportCenter.findFirst({
      where: this.notDeleted({ id: centerId }),
      select: { id: true },
    });

    if (!center) {
      throw new NotFoundException('Sport center not found');
    }

    this.validateTimeSlots(dto.priceSlots);

    return this.prisma.$transaction(async (tx) => {
      // Delete existing
      await tx.centerPriceSlot.deleteMany({
        where: { centerId },
      });

      // Insert new (may be empty — basePrice covers any gaps)
      if (dto.priceSlots.length > 0) {
        await tx.centerPriceSlot.createMany({
          data: dto.priceSlots.map(slot => ({
            centerId,
            startTime: slot.startTime,
            endTime: slot.endTime,
            pricePerHour: slot.pricePerHour,
          })),
        });
      }

      return tx.centerPriceSlot.findMany({
        where: { centerId },
        orderBy: { startTime: 'asc' },
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Cancellation policy (tiered preservation credit refund)
  // ─────────────────────────────────────────────────────────────

  /**
   * Returns the cancellation policy for a center including the flag and all tiers.
   */
  async getCancellationPolicy(centerId: string) {
    const center = await this.prisma.sportCenter.findFirst({
      where: this.notDeleted({ id: centerId }),
      select: {
        id: true,
        allowCancellation: true,
        cancellationTiers: {
          orderBy: { minDaysBeforeStart: 'desc' },
        },
      },
    });

    if (!center) throw new NotFoundException('Sport center not found');

    return {
      centerId: center.id,
      allowCancellation: center.allowCancellation,
      tiers: center.cancellationTiers,
    };
  }

  /**
   * Replaces the cancellation policy for a center.
   * Verifies ownership before applying changes.
   * Tiers are fully replaced in a single transaction.
   */
  async updateCancellationPolicy(
    centerId: string,
    ownerId: string,
    dto: { allowCancellation?: boolean; tiers?: { minDaysBeforeStart: number; refundPercent: number }[] },
  ) {
    const center = await this.prisma.sportCenter.findFirst({
      where: this.notDeleted({ id: centerId }),
      select: { id: true, ownerId: true },
    });

    if (!center) throw new NotFoundException('Sport center not found');
    if (center.ownerId !== ownerId) {
      throw new BadRequestException('You are not the owner of this sport center');
    }

    return this.prisma.$transaction(async (tx) => {
      // Update flag if provided
      if (dto.allowCancellation !== undefined) {
        await tx.sportCenter.update({
          where: { id: centerId },
          data: { allowCancellation: dto.allowCancellation },
        });
      }

      // Full replace of tiers if provided
      if (dto.tiers !== undefined) {
        await tx.cancellationTier.deleteMany({ where: { centerId } });

        if (dto.tiers.length > 0) {
          await tx.cancellationTier.createMany({
            data: dto.tiers.map(t => ({
              centerId,
              minDaysBeforeStart: t.minDaysBeforeStart,
              refundPercent: t.refundPercent,
            })),
          });
        }
      }

      return tx.sportCenter.findFirst({
        where: { id: centerId },
        select: {
          id: true,
          allowCancellation: true,
          cancellationTiers: { orderBy: { minDaysBeforeStart: 'desc' } },
        },
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Owner: preservation credit visibility
  // ─────────────────────────────────────────────────────────────

  /**
   * Returns all player credit wallets for a sport center.
   * Each wallet includes the last transaction enriched with its booking details,
   * so the owner gets a quick view of who holds credit and why.
   * Also returns totalOutstandingCredit — the total liability across all wallets.
   */
  async getCenterCreditWallets(
    centerId: string,
    ownerId: string,
    limit = 20,
    offset = 0,
  ) {
    const center = await this.prisma.sportCenter.findFirst({
      where: this.notDeleted({ id: centerId }),
      select: { id: true, ownerId: true },
    });

    if (!center) throw new NotFoundException('Sport center not found');
    if (center.ownerId !== ownerId) {
      throw new BadRequestException('You are not the owner of this sport center');
    }

    const [wallets, total] = await this.prisma.$transaction([
      this.prisma.sportCenterCredit.findMany({
        where: { centerId },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 1, // most recent transaction preview per wallet
          },
        },
        orderBy: { balance: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.sportCenterCredit.count({ where: { centerId } }),
    ]);

    // Compute total outstanding credit liability
    const totalOutstandingCredit = wallets.reduce(
      (sum, w) => sum + Number(w.balance),
      0,
    );

    // Enrich each wallet's last transaction with booking details
    const enrichedWallets = await Promise.all(
      wallets.map(async (wallet) => ({
        ...wallet,
        transactions: await this.enrichTransactionsWithBookings(wallet.transactions),
      })),
    );

    return {
      data: enrichedWallets,
      totalOutstandingCredit,
      pagination: { limit, offset, total },
    };
  }

  /**
   * Returns the full credit transaction history for a specific player at this center,
   * with each transaction enriched with its related booking details.
   * Intended for owner support and dispute resolution.
   */
  async getPlayerCreditTransactionsForOwner(
    centerId: string,
    ownerId: string,
    playerId: string,
    limit = 20,
    offset = 0,
  ) {
    const center = await this.prisma.sportCenter.findFirst({
      where: this.notDeleted({ id: centerId }),
      select: { id: true, ownerId: true, name: true },
    });

    if (!center) throw new NotFoundException('Sport center not found');
    if (center.ownerId !== ownerId) {
      throw new BadRequestException('You are not the owner of this sport center');
    }

    const wallet = await this.prisma.sportCenterCredit.findUnique({
      where: { playerId_centerId: { playerId, centerId } },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        },
      },
    });

    const rawTransactions = wallet?.transactions ?? [];

    return {
      centerId,
      centerName: center.name,
      playerId,
      balance: wallet ? Number(wallet.balance) : 0,
      transactions: await this.enrichTransactionsWithBookings(rawTransactions),
    };
  }

  async listOwnerCustomers(ownerId: string, query: ListCustomersQueryDto) {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const centers = await this.resolveOwnedCenters(ownerId, query.centerId);

    if (centers.length === 0) {
      return {
        scope: { centerId: query.centerId ?? null, centers: [] },
        data: [],
        pagination: { limit, offset, total: 0 },
      };
    }

    const centerIds = centers.map(center => center.id);
    const bookings = await this.prisma.booking.findMany({
      where: { centerId: { in: centerIds } },
      select: {
        id: true,
        centerId: true,
        playerId: true,
        playerName: true,
        phoneNumber: true,
        date: true,
        status: true,
        totalPrice: true,
        creditApplied: true,
        paymentRemaining: true,
        createdAt: true,
        cancelledAt: true,
        cancelReason: true,
        center: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    if (bookings.length === 0) {
      return {
        scope: { centerId: query.centerId ?? null, centers },
        data: [],
        pagination: { limit, offset, total: 0 },
      };
    }

    const playerIds = Array.from(new Set(bookings.map(booking => booking.playerId)));
    const playerMap = await this.fetchPlayerDetails(playerIds);
    const aggregates = new Map<string, CustomerAggregate>();

    for (const booking of bookings) {
      const authPlayer = playerMap.get(booking.playerId);
      const existing = aggregates.get(booking.playerId) ?? {
        customerId: booking.playerId,
        displayName: authPlayer?.name || booking.playerName || 'Unknown Customer',
        email: authPlayer?.email ?? null,
        avatarUrl: authPlayer?.avatarUrl ?? null,
        phoneNumber: booking.phoneNumber ?? null,
        phoneNumbers: new Set<string>(),
        nameCandidates: new Set<string>(),
        emailCandidates: new Set<string>(),
        centerIds: new Set<string>(),
        visitCount: 0,
        completedVisitCount: 0,
        confirmedVisitCount: 0,
        pendingVisitCount: 0,
        cancelledVisitCount: 0,
        totalSpend: 0,
        cancelledSpend: 0,
        firstVisitAt: booking.date,
        lastVisitAt: booking.date,
        latestBookingAt: null as Date | null,
        latestBooking: null,
        byCenter: new Map<string, CustomerCenterSummary>(),
        totalCreditBalance: 0,
      };

      existing.displayName = authPlayer?.name || existing.displayName || booking.playerName || 'Unknown Customer';
      existing.email = authPlayer?.email ?? existing.email;
      existing.avatarUrl = authPlayer?.avatarUrl ?? existing.avatarUrl;
      existing.phoneNumber = booking.phoneNumber ?? existing.phoneNumber;

      if (booking.playerName) existing.nameCandidates.add(booking.playerName);
      if (authPlayer?.name) existing.nameCandidates.add(authPlayer.name);
      if (authPlayer?.email) existing.emailCandidates.add(authPlayer.email);
      if (booking.phoneNumber) existing.phoneNumbers.add(booking.phoneNumber);

      existing.centerIds.add(booking.centerId);
      existing.visitCount += 1;

      const totalPrice = this.toNumber(booking.totalPrice);
      const isCancelled = booking.status === 'CANCELLED';

      if (booking.status === 'COMPLETED') existing.completedVisitCount += 1;
      if (booking.status === 'CONFIRMED') existing.confirmedVisitCount += 1;
      if (booking.status === 'PENDING') existing.pendingVisitCount += 1;
      if (isCancelled) existing.cancelledVisitCount += 1;

      if (isCancelled) {
        existing.cancelledSpend += totalPrice;
      } else {
        existing.totalSpend += totalPrice;
      }

      if (!existing.firstVisitAt || booking.date.getTime() < existing.firstVisitAt.getTime()) {
        existing.firstVisitAt = booking.date;
      }
      if (!existing.lastVisitAt || booking.date.getTime() > existing.lastVisitAt.getTime()) {
        existing.lastVisitAt = booking.date;
      }
      if (!existing.latestBookingAt || booking.createdAt.getTime() > existing.latestBookingAt.getTime()) {
        existing.latestBookingAt = booking.createdAt;
        existing.latestBooking = {
          id: booking.id,
          date: booking.date,
          status: booking.status,
          totalPrice,
          creditApplied: this.toNumber(booking.creditApplied),
          paymentRemaining: this.toNumber(booking.paymentRemaining),
          cancelReason: booking.cancelReason,
          cancelledAt: booking.cancelledAt,
          center: booking.center,
          createdAt: booking.createdAt,
        };
      }

      const centerSummary = existing.byCenter.get(booking.centerId) ?? {
        centerId: booking.centerId,
        centerName: booking.center.name,
        visitCount: 0,
        totalSpend: 0,
        cancelledVisitCount: 0,
        cancelledSpend: 0,
        lastVisitAt: null,
      };

      centerSummary.visitCount += 1;
      if (isCancelled) {
        centerSummary.cancelledVisitCount += 1;
        centerSummary.cancelledSpend += totalPrice;
      } else {
        centerSummary.totalSpend += totalPrice;
      }
      if (!centerSummary.lastVisitAt || booking.date.getTime() > centerSummary.lastVisitAt.getTime()) {
        centerSummary.lastVisitAt = booking.date;
      }

      existing.byCenter.set(booking.centerId, centerSummary);
      aggregates.set(booking.playerId, existing);
    }

    const creditWallets = await this.prisma.sportCenterCredit.findMany({
      where: {
        centerId: { in: centerIds },
        playerId: { in: playerIds },
      },
      select: {
        playerId: true,
        balance: true,
      },
    });

    for (const wallet of creditWallets) {
      const aggregate = aggregates.get(wallet.playerId);
      if (aggregate) {
        aggregate.totalCreditBalance += this.toNumber(wallet.balance);
      }
    }

    const filtered = Array.from(aggregates.values()).filter((aggregate) => {
      const candidateText = [
        aggregate.displayName,
        aggregate.email ?? '',
        aggregate.phoneNumber ?? '',
        ...Array.from(aggregate.nameCandidates),
        ...Array.from(aggregate.emailCandidates),
        ...Array.from(aggregate.phoneNumbers),
      ].map(value => this.normalizeText(value));

      const matchesField = (filter?: string, values: string[] = candidateText) => {
        if (!filter) return true;
        const needle = this.normalizeText(filter);
        return values.some(value => value.includes(needle));
      };

      const keyword = query.keyword ? this.normalizeText(query.keyword) : '';
      if (keyword) {
        const keywordValues = [
          aggregate.displayName,
          aggregate.email ?? '',
          aggregate.phoneNumber ?? '',
          ...Array.from(aggregate.nameCandidates),
          ...Array.from(aggregate.emailCandidates),
          ...Array.from(aggregate.phoneNumbers),
        ].map(value => this.normalizeText(value));

        if (!keywordValues.some(value => value.includes(keyword))) {
          return false;
        }
      }

      if (!matchesField(query.name, [aggregate.displayName, ...Array.from(aggregate.nameCandidates).map(value => this.normalizeText(value))])) {
        return false;
      }

      if (!matchesField(query.phone, [aggregate.phoneNumber ?? '', ...Array.from(aggregate.phoneNumbers).map(value => this.normalizeText(value))])) {
        return false;
      }

      if (!matchesField(query.email, [aggregate.email ?? '', ...Array.from(aggregate.emailCandidates).map(value => this.normalizeText(value))])) {
        return false;
      }

      if (!this.isWithinDateRange(aggregate.lastVisitAt, query.lastVisitFrom, query.lastVisitTo)) {
        return false;
      }

      if (!this.isWithinSpendRange(aggregate.totalSpend, query.minSpend, query.maxSpend)) {
        return false;
      }

      return true;
    });

    filtered.sort((left, right) => {
      const leftLast = left.lastVisitAt?.getTime() ?? 0;
      const rightLast = right.lastVisitAt?.getTime() ?? 0;
      if (rightLast !== leftLast) return rightLast - leftLast;

      if (right.totalSpend !== left.totalSpend) {
        return right.totalSpend - left.totalSpend;
      }

      return left.displayName.localeCompare(right.displayName);
    });

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    const data: CustomerListItem[] = paginated.map((aggregate) => ({
      customer: {
        id: aggregate.customerId,
        name: aggregate.displayName,
        email: aggregate.email,
        avatarUrl: aggregate.avatarUrl,
        phoneNumber: aggregate.phoneNumber,
      },
      summary: {
        visitCount: aggregate.visitCount,
        completedVisitCount: aggregate.completedVisitCount,
        confirmedVisitCount: aggregate.confirmedVisitCount,
        pendingVisitCount: aggregate.pendingVisitCount,
        cancelledVisitCount: aggregate.cancelledVisitCount,
        totalSpend: aggregate.totalSpend,
        cancelledSpend: aggregate.cancelledSpend,
        creditBalance: aggregate.totalCreditBalance,
        firstVisitAt: aggregate.firstVisitAt,
        lastVisitAt: aggregate.lastVisitAt,
        centerCount: aggregate.centerIds.size,
      },
      centers: Array.from(aggregate.byCenter.values()).sort((left, right) => left.centerName.localeCompare(right.centerName)),
      latestBooking: aggregate.latestBooking,
    }));

    return {
      scope: { centerId: query.centerId ?? null, centers },
      data,
      pagination: { limit, offset, total },
    };
  }

  async getOwnerCustomerDetail(ownerId: string, customerId: string, centerId?: string) {
    const centers = await this.resolveOwnedCenters(ownerId, centerId);

    if (centers.length === 0) {
      throw new NotFoundException('Customer not found');
    }

    const ownedCenterIds = centers.map(center => center.id);
    const bookings = await this.prisma.booking.findMany({
      where: {
        centerId: { in: ownedCenterIds },
        playerId: customerId,
      },
      select: {
        id: true,
        centerId: true,
        playerId: true,
        playerName: true,
        phoneNumber: true,
        date: true,
        status: true,
        totalPrice: true,
        creditApplied: true,
        paymentRemaining: true,
        createdAt: true,
        cancelledAt: true,
        cancelReason: true,
        center: {
          select: { id: true, name: true },
        },
        bookingItems: {
          select: {
            startTime: true,
            endTime: true,
            itemPrice: true,
            court: {
              select: { id: true, name: true },
            },
          },
          orderBy: { startTime: 'asc' },
        },
      },
      orderBy: [
        { date: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const byCenterMap = new Map<string, {
      centerId: string;
      centerName: string;
      creditBalance: number;
      visitCount: number;
      totalSpend: number;
      cancelledVisitCount: number;
      cancelledSpend: number;
      lastVisitAt: Date | null;
      latestCreditTransaction: any | null;
    }>();

    for (const booking of bookings) {
      const totalPrice = this.toNumber(booking.totalPrice);
      const isCancelled = booking.status === 'CANCELLED';
      const existing = byCenterMap.get(booking.centerId) ?? {
        centerId: booking.centerId,
        centerName: booking.center.name,
        creditBalance: 0,
        visitCount: 0,
        totalSpend: 0,
        cancelledVisitCount: 0,
        cancelledSpend: 0,
        lastVisitAt: null,
        latestCreditTransaction: null,
      };

      existing.visitCount += 1;
      if (isCancelled) {
        existing.cancelledVisitCount += 1;
        existing.cancelledSpend += totalPrice;
      } else {
        existing.totalSpend += totalPrice;
      }
      if (!existing.lastVisitAt || booking.date.getTime() > existing.lastVisitAt.getTime()) {
        existing.lastVisitAt = booking.date;
      }

      byCenterMap.set(booking.centerId, existing);
    }

    const creditWallets = await this.prisma.sportCenterCredit.findMany({
      where: {
        centerId: { in: ownedCenterIds },
        playerId: customerId,
      },
      select: {
        id: true,
        playerId: true,
        centerId: true,
        balance: true,
        center: {
          select: { id: true, name: true },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { balance: 'desc' },
    });

    if (bookings.length === 0 && creditWallets.length === 0) {
      throw new NotFoundException('Customer not found');
    }

    const playerMap = await this.fetchPlayerDetails([customerId]);
    const authPlayer = playerMap.get(customerId);

    const summary = bookings.reduce(
      (acc, booking) => {
        const totalPrice = this.toNumber(booking.totalPrice);
        const isCancelled = booking.status === 'CANCELLED';

        acc.visitCount += 1;
        if (booking.status === 'COMPLETED') acc.completedVisitCount += 1;
        if (booking.status === 'CONFIRMED') acc.confirmedVisitCount += 1;
        if (booking.status === 'PENDING') acc.pendingVisitCount += 1;
        if (isCancelled) {
          acc.cancelledVisitCount += 1;
          acc.cancelledSpend += totalPrice;
        } else {
          acc.totalSpend += totalPrice;
        }

        if (!acc.firstVisitAt || booking.date.getTime() < acc.firstVisitAt.getTime()) {
          acc.firstVisitAt = booking.date;
        }
        if (!acc.lastVisitAt || booking.date.getTime() > acc.lastVisitAt.getTime()) {
          acc.lastVisitAt = booking.date;
        }

        return acc;
      },
      {
        visitCount: 0,
        completedVisitCount: 0,
        confirmedVisitCount: 0,
        pendingVisitCount: 0,
        cancelledVisitCount: 0,
        totalSpend: 0,
        cancelledSpend: 0,
        firstVisitAt: null as Date | null,
        lastVisitAt: null as Date | null,
      },
    );

    const walletBalance = creditWallets.reduce((sum, wallet) => sum + this.toNumber(wallet.balance), 0);
    const cancelledRefundTransactions = await this.prisma.creditTransaction.findMany({
      where: {
        type: 'CANCELLATION_REFUND',
        credit: {
          playerId: customerId,
          centerId: { in: ownedCenterIds },
        },
      },
      select: {
        amount: true,
      },
    });

    const cancelledRefundAmount = cancelledRefundTransactions.reduce((sum, transaction) => sum + this.toNumber(transaction.amount), 0);

    for (const wallet of creditWallets) {
      const existing = byCenterMap.get(wallet.centerId) ?? {
        centerId: wallet.centerId,
        centerName: wallet.center.name,
        creditBalance: 0,
        visitCount: 0,
        totalSpend: 0,
        cancelledVisitCount: 0,
        cancelledSpend: 0,
        lastVisitAt: null,
        latestCreditTransaction: null,
      };

      existing.creditBalance = this.toNumber(wallet.balance);
      existing.latestCreditTransaction = wallet.transactions[0]
        ? {
          id: wallet.transactions[0].id,
          bookingId: wallet.transactions[0].bookingId,
          amount: this.toNumber(wallet.transactions[0].amount),
          type: wallet.transactions[0].type,
          description: wallet.transactions[0].description,
          createdAt: wallet.transactions[0].createdAt,
        }
        : null;

      byCenterMap.set(wallet.centerId, existing);
    }

    const byCenter = Array.from(byCenterMap.values()).sort((left, right) => left.centerName.localeCompare(right.centerName));

    const recentBookings = bookings.slice(0, 5).map((booking) => ({
      id: booking.id,
      center: booking.center,
      date: booking.date,
      status: booking.status,
      totalPrice: this.toNumber(booking.totalPrice),
      creditApplied: this.toNumber(booking.creditApplied),
      paymentRemaining: this.toNumber(booking.paymentRemaining),
      cancelReason: booking.cancelReason,
      cancelledAt: booking.cancelledAt,
      createdAt: booking.createdAt,
      bookingItems: booking.bookingItems.map((item) => ({
        startTime: item.startTime,
        endTime: item.endTime,
        itemPrice: this.toNumber(item.itemPrice),
        court: item.court,
      })),
    }));

    return {
      scope: { centerId: centerId ?? null, centers },
      customer: {
        id: customerId,
        name: authPlayer?.name || bookings[0]?.playerName || 'Unknown Customer',
        email: authPlayer?.email ?? null,
        avatarUrl: authPlayer?.avatarUrl ?? null,
        phoneNumber: bookings.find((booking) => !!booking.phoneNumber)?.phoneNumber ?? null,
      },
      summary: {
        ...summary,
        creditBalance: walletBalance,
        cancelledRefundAmount,
      },
      byCenter,
      recentBookings,
      creditWallets: creditWallets.map((wallet) => ({
        centerId: wallet.centerId,
        centerName: wallet.center.name,
        creditBalance: this.toNumber(wallet.balance),
        latestCreditTransaction: wallet.transactions[0]
          ? {
            id: wallet.transactions[0].id,
            bookingId: wallet.transactions[0].bookingId,
            amount: this.toNumber(wallet.transactions[0].amount),
            type: wallet.transactions[0].type,
            description: wallet.transactions[0].description,
            createdAt: wallet.transactions[0].createdAt,
          }
          : null,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Batch-fetches booking details for all non-null bookingIds in a list of
   * credit transactions and merges them inline as a `booking` field.
   */
  private async enrichTransactionsWithBookings(
    transactions: { bookingId?: string | null;[key: string]: any }[],
  ) {
    const bookingIds = [
      ...new Set(
        transactions.map((t) => t.bookingId).filter(Boolean) as string[],
      ),
    ];

    if (bookingIds.length === 0) {
      return transactions.map((t) => ({ ...t, booking: null }));
    }

    const bookings = await this.prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      select: {
        id: true,
        date: true,
        status: true,
        totalPrice: true,
        creditApplied: true,
        paymentRemaining: true,
        center: {
          select: { id: true, name: true },
        },
        bookingItems: {
          select: {
            startTime: true,
            endTime: true,
            itemPrice: true,
            court: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    const bookingMap = new Map(
      bookings.map((b) => {
        const startTimes = b.bookingItems.map((item) => item.startTime).sort();
        const endTimes = b.bookingItems.map((item) => item.endTime).sort();

        return [
          b.id,
          {
            id: b.id,
            date: b.date,
            startTime: startTimes[0] ?? null,
            endTime: endTimes[endTimes.length - 1] ?? null,
            status: b.status,
            totalPrice: b.totalPrice,
            creditApplied: b.creditApplied,
            paymentRemaining: b.paymentRemaining,
            center: b.center,
            bookingItems: b.bookingItems.map((item) => ({
              startTime: item.startTime,
              endTime: item.endTime,
              itemPrice: item.itemPrice,
              court: item.court,
            })),
          },
        ];
      }),
    );

    return transactions.map((t) => ({
      ...t,
      booking: t.bookingId ? (bookingMap.get(t.bookingId) ?? null) : null,
    }));
  }
}
