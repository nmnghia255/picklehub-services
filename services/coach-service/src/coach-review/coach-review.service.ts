import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuthIntegrationService } from '../auth-integration/auth-integration.service';
import { CreateCoachReviewDto } from './dto/create-coach-review.dto';
import { UpdateCoachReviewDto } from './dto/update-coach-review.dto';

@Injectable()
export class CoachReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authIntegration: AuthIntegrationService,
  ) {}

  async createReview(coachId: string, reviewerId: string, dto: CreateCoachReviewDto) {
    const profile = await this.prisma.coachProfile.findUnique({
      where: { id: coachId }
    });

    if (!profile) {
      throw new NotFoundException('Coach profile not found');
    }

    if (profile.userId === reviewerId) {
      throw new BadRequestException('You cannot review yourself');
    }

    const existing = await this.prisma.coachReview.findUnique({
      where: {
        coachProfileId_reviewerId: {
          coachProfileId: coachId,
          reviewerId,
        }
      }
    });

    if (existing) {
      throw new BadRequestException('You have already reviewed this coach');
    }

    return this.prisma.coachReview.create({
      data: {
        coachProfileId: coachId,
        reviewerId,
        rating: dto.rating,
        comment: dto.comment,
      }
    });
  }

  async getCoachReviews(coachId: string) {
    const reviews = await this.prisma.coachReview.findMany({
      where: { coachProfileId: coachId },
      orderBy: { createdAt: 'desc' }
    });
    
    // Map reviewerId to learnerId to reuse the generic enrichWithLearnerProfiles method 
    // or manually fetch and attach.
    const reviewerIds = reviews.map(r => r.reviewerId);
    const profilesMap = await this.authIntegration.getUsersProfiles(reviewerIds);
    
    const enrichedReviews = reviews.map(review => ({
      ...review,
      reviewerProfile: profilesMap.get(review.reviewerId) || null,
    }));

    const reviewCount = reviews.length;
    const totalScore = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = reviewCount > 0 ? parseFloat((totalScore / reviewCount).toFixed(1)) : 0;

    return {
      reviewCount,
      averageRating,
      reviews: enrichedReviews,
    };
  }

  async updateReview(reviewId: string, reviewerId: string, dto: UpdateCoachReviewDto) {
    const review = await this.prisma.coachReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found.');
    }

    if (review.reviewerId !== reviewerId) {
      throw new BadRequestException('You are not authorized to update this review.');
    }

    return this.prisma.coachReview.update({
      where: { id: reviewId },
      data: dto,
    });
  }

  async deleteReview(reviewId: string, reviewerId: string) {
    const review = await this.prisma.coachReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Review not found.');
    }

    if (review.reviewerId !== reviewerId) {
      throw new BadRequestException('You are not authorized to delete this review.');
    }

    return this.prisma.coachReview.delete({
      where: { id: reviewId },
    });
  }
}
