import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CenterService } from '../center/center.service';

@Injectable()
export class FavouriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly centerService: CenterService,
  ) {}

  async add(userId: string, centerId: string) {
    const center = await this.prisma.sportCenter.findUnique({
      where: { id: centerId },
    });

    if (!center) {
      throw new NotFoundException('Sport center not found');
    }

    try {
      return await this.prisma.favourite.create({
        data: {
          userId,
          centerId,
        },
      });
    } catch (error) {
      // Handle unique constraint failure (P2002)
      if (error.code === 'P2002') {
        throw new ConflictException('Sport center is already favourited');
      }
      throw error;
    }
  }

  async remove(userId: string, centerId: string) {
    const favourite = await this.prisma.favourite.findUnique({
      where: {
        userId_centerId: {
          userId,
          centerId,
        },
      },
    });

    if (!favourite) {
      throw new NotFoundException('Favourite not found');
    }

    return this.prisma.favourite.delete({
      where: {
        userId_centerId: {
          userId,
          centerId,
        },
      },
    });
  }

  async findMyFavourites(userId: string) {
    // Get all favourite center IDs for the user
    const favourites = await this.prisma.favourite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { centerId: true },
    });
    const centerIds = favourites.map(fav => fav.centerId);
    if (centerIds.length === 0) {
      return { data: [], pagination: { limit: 0, offset: 0, total: 0 } };
    }
    // Fetch full center details for these IDs, using the same logic as findActive
    // We'll mimic the findActive response but filter by centerIds
    // No pagination for now (could be added if needed)
    const items = await this.prisma.sportCenter.findMany({
      where: {
        id: { in: centerIds },
        deletedAt: null,
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { courts: true } },
        services: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
        products: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    const itemsWithStats = await this.centerService["addReviewStatsToList"](items);
    const itemsWithStatsAndFavouriteFlag = await this.centerService["addFavouriteFlagsToList"](itemsWithStats, userId);
    return {
      data: itemsWithStatsAndFavouriteFlag,
      pagination: {
        limit: itemsWithStatsAndFavouriteFlag.length,
        offset: 0,
        total: itemsWithStatsAndFavouriteFlag.length,
      },
    };
  }

  async checkStatus(userId: string, centerId: string) {
    const favourite = await this.prisma.favourite.findUnique({
      where: {
        userId_centerId: {
          userId,
          centerId,
        },
      },
    });
    return { isFavourite: !!favourite };
  }
}
