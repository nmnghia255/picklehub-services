import { Body, Controller, Post, Get, UseGuards, Req } from "@nestjs/common";
import { NotificationService } from "./notification.service.js";
import {
    ApiBearerAuth,
    ApiBadRequestResponse,
    ApiInternalServerErrorResponse,
    ApiOperation,
    ApiResponse,
    ApiUnauthorizedResponse,
    ApiTags,
    ApiSecurity,
} from "@nestjs/swagger";
import { NotificationDto } from "./dto/notification.dto.js";
import { GroupFeedDto } from "./dto/group-feed.dto.js";
import { InternalServiceGuard } from "../guards/internal-service.guard.js";
import { JwtAuthGuard } from "../guards/jwt-auth.guard.js";

@ApiTags('Notifications')
@Controller('notification')
export class NotificationController {
    constructor(private notificationService: NotificationService) {}

    // ─── POST /api/notification/send (internal) ───────────────────────────────

    @Post('send')
    @UseGuards(InternalServiceGuard)
    @ApiSecurity('internal-token')
    @ApiOperation({
        summary: 'Send in-app notifications [Internal]',
        description: `
**Internal endpoint** — called by other services (auth, group, coach, etc.) to deliver
in-app notifications to one or more users.

Automatically also fires an **Expo push notification** to each user's registered mobile
devices (if any). Push failures are silent and never affect the response.

> 🔒 Requires the \`Authorization: Bearer <SERVICE_INTERNAL_TOKEN>\` header.
        `,
    })
    @ApiResponse({
        status: 201,
        description: 'Notifications created and push dispatched.',
        schema: {
            example: {
                message: 'Notifications sent successfully.',
                data: { count: 2 },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid request body (missing userIds, title, or message).' })
    @ApiUnauthorizedResponse({ description: 'Missing or invalid SERVICE_INTERNAL_TOKEN.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    async sendNotification(@Body() notificationDto: NotificationDto) {
        return this.notificationService.sendMany(notificationDto);
    }

    // ─── POST /api/notification/feed (internal) ───────────────────────────────

    @Post('feed')
    @UseGuards(InternalServiceGuard)
    @ApiSecurity('internal-token')
    @ApiOperation({
        summary: 'Send a group feed notification [Internal]',
        description: `
**Internal endpoint** — called by the group service to broadcast a feed-level event
(e.g. new post, new match) to a group.

> 🔒 Requires the \`Authorization: Bearer <SERVICE_INTERNAL_TOKEN>\` header.
        `,
    })
    @ApiResponse({
        status: 201,
        description: 'Feed notification created successfully.',
        schema: {
            example: {
                message: 'Feed notification sent successfully.',
                data: {
                    groupId: 'a1b2c3d4-0000-0000-0000-000000000001',
                    title: 'New match scheduled',
                    message: 'A new match has been added to your group.',
                },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid request body (missing groupId, title, or message).' })
    @ApiUnauthorizedResponse({ description: 'Missing or invalid SERVICE_INTERNAL_TOKEN.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    async sendFeedNotification(@Body() feedDto: GroupFeedDto) {
        return this.notificationService.sendFeedNotification(feedDto);
    }

    // ─── GET /api/notification (user) ────────────────────────────────────────

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('access-token')
    @ApiOperation({
        summary: 'Get my in-app notifications',
        description: `
Returns all in-app notifications for the currently authenticated user,
ordered from newest to oldest.

**📱 Mobile Integration:** Call this on app open or when the user opens
the notification bell/tab to display their notification list.
        `,
    })
    @ApiResponse({
        status: 200,
        description: 'Notifications retrieved successfully.',
        schema: {
            example: {
                message: 'Notifications retrieved successfully.',
                data: [
                    {
                        id: '3a0c173f-e79c-49a8-b67c-c4260db7ff89',
                        userId: 'd3387cc5-cbd4-4832-a22e-d463bb2e2df1',
                        title: 'Coach booking confirmed',
                        message: 'Your session with Coach Minh is confirmed for Saturday 9AM.',
                        metadata: { coachProfileId: 'c0000001-c000-4000-8000-000000000001' },
                        isRead: false,
                        createdAt: '2025-01-01T12:00:00.000Z',
                    },
                ],
            },
        },
    })
    @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT Bearer token.' })
    @ApiInternalServerErrorResponse({ description: 'Unexpected server error.' })
    async getMyNotifications(@Req() req: any) {
        const userId = req.user.userId;
        return this.notificationService.getMyNotifications(userId);
    }
}