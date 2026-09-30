import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { GroupActivityStatus } from '@prisma/client';

@Processor('activity-reminder-queue')
export class ActivityReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ActivityReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<{ activityId: string; groupId: string }, any, string>): Promise<any> {
    const { activityId, groupId } = job.data;
    this.logger.log(`Processing reminder for activity ${activityId}`);

    try {
      const activity = await this.prisma.groupActivity.findUnique({
        where: { id: activityId },
      });

      if (!activity) {
        this.logger.warn(`Activity ${activityId} not found, skipping reminder`);
        return;
      }

      if (activity.status !== GroupActivityStatus.SCHEDULED) {
        this.logger.warn(`Activity ${activityId} is not SCHEDULED, skipping reminder`);
        return;
      }

      if (activity.isReminderSent) {
        this.logger.warn(`Reminder for activity ${activityId} already sent, skipping`);
        return;
      }

      // Get all group members
      const members = await this.prisma.groupMember.findMany({
        where: { groupId },
        select: { userId: true },
      });

      if (members.length === 0) {
        this.logger.warn(`Group ${groupId} has no members, skipping reminder`);
        return;
      }

      const userIds = members.map((m) => m.userId);

      // Call notification service
      const title = `Nhắc nhở lịch hoạt động nhóm: ${activity.title}`;
      const message = `Hoạt động "${activity.title}" sắp diễn ra vào lúc ${activity.startAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Bạn nhớ tham gia nhé!`;

      await this.notificationService.sendInAppNotification(userIds, title, message);

      // Update isReminderSent = true
      await this.prisma.groupActivity.update({
        where: { id: activityId },
        data: { isReminderSent: true },
      });

      this.logger.log(`Successfully sent reminder for activity ${activityId}`);
    } catch (error) {
      this.logger.error(`Failed to process reminder for activity ${activityId}:`, error);
      throw error; // Let BullMQ handle retries
    }
  }
}
