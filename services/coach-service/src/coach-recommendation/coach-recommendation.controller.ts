import { Controller, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CoachRecommendationService } from './coach-recommendation.service';
import { CreateCoachRecommendationDto } from './dto/create-coach-recommendation.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('Coach Recommendations')
@Controller()
export class CoachRecommendationController {
  constructor(private readonly recommendationService: CoachRecommendationService) {}

  @Post('api/coaches/:coachId/recommendations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ 
    summary: '(Authenticated User) Recommend a coach to a friend',
    description: 'Allows an authenticated user to recommend a coach to another user.\n\n**Frontend Integration:** Add a "Share / Recommend" button on the coach profile page. When clicked, open a modal allowing the user to select a friend (by their user ID) and optionally type a personal message. Once submitted, this endpoint will store the recommendation and **trigger an in-app notification** via `notification-service` to the target user so they receive the recommendation instantly. The triggered notification includes `metadata: { onClickSupport: { coachProfileId } }` to allow frontend routing directly to the coach profile.'
  })
  @ApiParam({ name: 'coachId', description: 'Coach profile UUID (NOT user ID).', example: 'c0000001-c000-4000-8000-000000000001' })
  @ApiResponse({ 
    status: 201, 
    description: 'Recommendation sent successfully',
    schema: {
      example: {
        id: 'rec00001-rec0-4000-8000-000000000001',
        coachProfileId: 'c0000001-c000-4000-8000-000000000001',
        recommenderId: 'a0000001-a000-4000-8000-000000000001',
        recommendedToId: 'd3387cc5-cbd4-4832-a22e-d463bb2e2df1',
        message: 'Bạn nên xem qua huấn luyện viên này nhé!',
        createdAt: '2026-06-01T00:00:00.000Z'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad Request — User is trying to recommend a coach to themselves.' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid Bearer token.' })
  @ApiResponse({ status: 404, description: 'Not Found — Coach profile not found.' })
  async recommendCoach(
    @Param('coachId') coachId: string,
    @Body() dto: CreateCoachRecommendationDto,
    @Request() req: any,
  ) {
    return this.recommendationService.recommendCoach(coachId, req.user.userId, dto);
  }
}
