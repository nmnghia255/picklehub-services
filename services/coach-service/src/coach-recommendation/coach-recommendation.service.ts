import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCoachRecommendationDto } from './dto/create-coach-recommendation.dto';
import { NotificationIntegrationService } from '../notification-integration/notification-integration.service';
import { AuthIntegrationService } from '../auth-integration/auth-integration.service';

@Injectable()
export class CoachRecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationIntegrationService,
    private readonly authIntegration: AuthIntegrationService,
  ) {}

  async recommendCoach(coachId: string, recommenderId: string, dto: CreateCoachRecommendationDto) {
    if (recommenderId === dto.recommendedToId) {
      throw new BadRequestException('You cannot recommend a coach to yourself');
    }

    const profile = await this.prisma.coachProfile.findUnique({
      where: { id: coachId }
    });

    if (!profile) {
      throw new NotFoundException('Coach profile not found');
    }

    const recommendation = await this.prisma.coachRecommendation.create({
      data: {
        coachProfileId: coachId,
        recommenderId,
        recommendedToId: dto.recommendedToId,
        message: dto.message,
      }
    });

    // To send a nice notification, we get the recommender's profile
    const profiles = await this.authIntegration.getUsersProfiles([recommenderId]);
    const recommenderProfile = profiles.get(recommenderId);
    const recommenderName = recommenderProfile ? recommenderProfile.name : 'Một người bạn';

    const title = `${recommenderName} đã giới thiệu một huấn luyện viên cho bạn`;
    const message = dto.message 
      ? `"${dto.message}" - Hãy xem qua huấn luyện viên ${profile.displayName} nhé!`
      : `Hãy xem qua huấn luyện viên ${profile.displayName} nhé!`;

    // Trigger in-app notification via notification-service
    await this.notificationService.sendNotification(
      [dto.recommendedToId], 
      title, 
      message,
      { onClickSupport: { coachProfileId: coachId } }
    );

    return recommendation;
  }
}
