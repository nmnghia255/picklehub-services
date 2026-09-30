import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { NotificationDto } from "./dto/notification.dto.js";
import { GroupFeedDto } from "./dto/group-feed.dto.js";
import { PrismaService } from "../prisma.service.js";
import { ExpoPushService } from "../push/expo-push.service.js";

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private prisma: PrismaService,
        private expoPushService: ExpoPushService,
    ) {}

    // Implemented in-app notification logic here

    /*
        This method handles sending in-app notifications to multiple users.
    */
    async sendMany(notificationDto: NotificationDto) {
        // Logic to send many in-app notification
        // update the database with the notification details and mark them as unread for the respective users
        const { userIds, title, message, metadata } = notificationDto;

        // Logic to create notifications in the database
        const notifications = userIds.map(userId => ({
            userId,
            title,
            message,
            metadata: metadata ? metadata : undefined,
            isRead: false, // Mark as unread
        }));

        try {
            // Save notifications to the database (existing in-app behavior)
            const res = await this.prisma.appNotification.createMany({ data: notifications });

            // Fire Expo push notifications to all registered mobile devices.
            // Errors are caught internally — never breaks the in-app notification flow.
            this.expoPushService
                .sendToUsers(userIds, title, message, metadata as Record<string, unknown> | undefined)
                .catch((err) => this.logger.error('Push notification dispatch failed', err));

            return {
                message: 'Notifications sent successfully.',
                data: res,
            };
        }
        catch (error) {
            console.error('Error sending notifications:', error);
            throw new InternalServerErrorException('Failed to send notifications. Please try again later.');
        }
    }

    /*
        This method retrieves in-app notifications for a specific user.
    */
    async getMyNotifications(userId: string) {
        // Logic to retrieve in-app notifications for a user
        try {
            // Retrive notifications from the database for the given user ID
            const notifications = await this.prisma.appNotification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' }, // Order by most recent
            });
            return {
                message: 'Notifications retrieved successfully.',
                data: notifications,
            }
        }
        catch (error) {
            console.error('Error retrieving notifications:', error);
            throw new InternalServerErrorException('Failed to retrieve notifications. Please try again later.');
        }
    }

    /**
     * Send feed notifications to groups
     */
    async sendFeedNotification(feedDto: GroupFeedDto
    ) {
        try {
            await this.prisma.groupFeedNotification.create({
                data: feedDto
            });
            console.log(`Feed notification sent to ${feedDto.groupId} group`);
        } catch (error) {
            console.error(`Failed to send feed notification: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }

        return { message: 'Feed notification sent successfully.',
                data: feedDto
         };
    }
}
