import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);
  private readonly authServiceUrl: string;
  private readonly authInternalToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://auth-service:8001';
    this.authInternalToken = this.configService.get<string>('SERVICE_INTERNAL_TOKEN') || '';
  }

  private async fetchUserNames(userIds: string[]): Promise<Map<string, string>> {
    const userNamesMap = new Map<string, string>();
    if (userIds.length === 0) return userNamesMap;

    try {
      const url = `${this.authServiceUrl}/api/auth/internal/users/batch`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': this.authInternalToken,
        },
        body: JSON.stringify({ userIds }),
      });

      if (response.ok) {
        const users = await response.json();
        for (const user of users) {
          if (user?.id && user?.name) {
            userNamesMap.set(user.id, user.name);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error fetching user names from auth-service: ${error}`);
    }

    return userNamesMap;
  }

  async create(userId: string, createReviewDto: CreateReviewDto) {
    const center = await this.prisma.sportCenter.findUnique({
      where: { id: createReviewDto.centerId },
    });

    if (!center) {
      throw new NotFoundException('Sport center not found');
    }

    return this.prisma.review.create({
      data: {
        userId,
        centerId: createReviewDto.centerId,
        rating: createReviewDto.rating,
        comment: createReviewDto.comment,
      },
    });
  }

  async findByCenterId(centerId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { centerId },
      orderBy: { createdAt: 'desc' },
    });

    const userIds = Array.from(new Set(reviews.map((r) => r.userId)));
    const userNamesMap = await this.fetchUserNames(userIds);

    return reviews.map((review) => ({
      ...review,
      userName: userNamesMap.get(review.userId) ?? 'Unknown User',
    }));
  }

  async findOne(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  async update(id: string, userId: string, updateReviewDto: UpdateReviewDto) {
    const review = await this.findOne(id);
    if (review.userId !== userId) {
      throw new NotFoundException('Review not found or unauthorized');
    }

    return this.prisma.review.update({
      where: { id },
      data: updateReviewDto,
    });
  }

  async remove(id: string, userId: string) {
    const review = await this.findOne(id);
    if (review.userId !== userId) {
      throw new NotFoundException('Review not found or unauthorized');
    }

    return this.prisma.review.delete({
      where: { id },
    });
  }
}
