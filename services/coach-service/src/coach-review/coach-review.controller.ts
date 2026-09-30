import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CoachReviewService } from './coach-review.service';
import { CreateCoachReviewDto } from './dto/create-coach-review.dto';
import { UpdateCoachReviewDto } from './dto/update-coach-review.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

const REVIEW_EXAMPLE = {
  id: '90000001-9000-4000-8000-000000000001',
  coachProfileId: 'c0000001-c000-4000-8000-000000000001',
  reviewerId: 'a0000001-a000-4000-8000-000000000001',
  rating: 5,
  comment: 'Great coach!',
  createdAt: '2026-06-01T00:00:00.000Z',
};

@ApiTags('Coach Reviews')
@Controller()
export class CoachReviewController {
  constructor(private readonly reviewService: CoachReviewService) {}

  @Post('api/coaches/:coachId/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ 
    summary: '(Authenticated User) Review a coach directly',
    description: 'Allows an authenticated user to submit a 1-5 star review and optional comment for a specific coach.\n\n**Frontend Integration:** Use this on the coach profile page when a user clicks "Write a Review". You do not need to check for enrollments or bookings.'
  })
  @ApiParam({ name: 'coachId', description: 'Coach profile UUID (NOT user ID).', example: 'c0000001-c000-4000-8000-000000000001' })
  @ApiResponse({ 
    status: 201, 
    description: 'Review successfully created',
    schema: { example: REVIEW_EXAMPLE }
  })
  @ApiResponse({ status: 400, description: 'Bad Request — User is trying to review themselves or has already reviewed this coach.' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid Bearer token.' })
  @ApiResponse({ status: 404, description: 'Not Found — Coach profile not found.' })
  async createReview(
    @Param('coachId') coachId: string,
    @Body() dto: CreateCoachReviewDto,
    @Request() req: any,
  ) {
    return this.reviewService.createReview(coachId, req.user.userId, dto);
  }

  @Get('api/coaches/:coachId/reviews')
  @ApiOperation({ 
    summary: '(Any) Get all public reviews for a coach',
    description: 'Returns a list of all reviews for the specified coach, ordered by newest first. Includes enriched `reviewerProfile` data from the auth-service for UI display.\n\n**Frontend Integration:** Call this on the coach profile page to display the list of reviews along with the reviewer names and avatars.'
  })
  @ApiParam({ name: 'coachId', description: 'Coach profile UUID (NOT user ID).', example: 'c0000001-c000-4000-8000-000000000001' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns a list of reviews for the specified coach',
    schema: {
      example: {
        reviewCount: 1,
        averageRating: 5.0,
        reviews: [
          {
            id: '90000001-9000-4000-8000-000000000001',
            coachProfileId: 'c0000001-c000-4000-8000-000000000001',
            reviewerId: 'a0000001-a000-4000-8000-000000000001',
            rating: 5,
            comment: 'Great coach!',
            createdAt: '2026-06-01T00:00:00.000Z',
            reviewerProfile: {
              id: 'a0000001-a000-4000-8000-000000000001',
              name: 'John Doe',
              email: 'john@example.com',
              role: 'USER',
              avatarUrl: 'https://cdn.picklehub.vn/avatars/user1.jpg'
            }
          }
        ]
      }
    }
  })
  async getCoachReviews(@Param('coachId') coachId: string) {
    return this.reviewService.getCoachReviews(coachId);
  }

  @Patch('api/coaches/:coachId/reviews/:reviewId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ 
    summary: '(Authenticated User) Update a review',
    description: 'Allows the original reviewer to update their review rating or comment.'
  })
  @ApiParam({ name: 'coachId', description: 'Coach profile UUID (NOT user ID).', example: 'c0000001-c000-4000-8000-000000000001' })
  @ApiParam({ name: 'reviewId', description: 'Review UUID.', example: '90000001-9000-4000-8000-000000000001' })
  @ApiResponse({ status: 200, description: 'Review successfully updated', schema: { example: { ...REVIEW_EXAMPLE, rating: 4, comment: 'Updated comment.' } } })
  @ApiResponse({ status: 400, description: 'Bad Request — Not authorized to update.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not Found.' })
  async updateReview(
    @Param('coachId') coachId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: UpdateCoachReviewDto,
    @Request() req: any,
  ) {
    return this.reviewService.updateReview(reviewId, req.user.userId, dto);
  }

  @Delete('api/coaches/:coachId/reviews/:reviewId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ 
    summary: '(Authenticated User) Delete a review',
    description: 'Allows the original reviewer to delete their review.'
  })
  @ApiParam({ name: 'coachId', description: 'Coach profile UUID (NOT user ID).', example: 'c0000001-c000-4000-8000-000000000001' })
  @ApiParam({ name: 'reviewId', description: 'Review UUID.', example: '90000001-9000-4000-8000-000000000001' })
  @ApiResponse({ status: 200, description: 'Review successfully deleted', schema: { example: REVIEW_EXAMPLE } })
  @ApiResponse({ status: 400, description: 'Bad Request — Not authorized to delete.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Not Found.' })
  async deleteReview(
    @Param('coachId') coachId: string,
    @Param('reviewId') reviewId: string,
    @Request() req: any,
  ) {
    return this.reviewService.deleteReview(reviewId, req.user.userId);
  }
}
