import { Controller, Post, Body, Headers, ForbiddenException } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { ApiExcludeController } from '@nestjs/swagger';

const INTERNAL_HEADER = 'x-internal-token';

@ApiExcludeController()
@Controller('internal/notifications')
export class InternalNotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  private checkToken(headers: any) {
    const token = process.env.SERVICE_INTERNAL_TOKEN;
    if (!token) throw new ForbiddenException('internal token not configured');
    if (headers[INTERNAL_HEADER] !== token) throw new ForbiddenException('invalid internal token');
  }

  @Post('invitation')
  async sendInvitationEmail(@Body() body: { email: string; inviterName: string; invitationUrl: string; groupName: string }, @Headers() headers: any) {
    this.checkToken(headers);
    const { email, inviterName, invitationUrl, groupName } = body;
    await this.notificationService.sendInvitationEmail(email, inviterName, invitationUrl, groupName);
    return { message: 'sent' };
  }
}
