import { Module } from '@nestjs/common';
import { GroupController, GroupMemberController } from './group.controller';
import { GroupService } from './group.service';
import { GroupInternalController } from '../internal/internal.controller';
import { GroupChatAccessInternalController } from '../internal/group-chat-access.internal.controller';
import { NotificationModule } from '../notification/notification.module';
import { PrismaService } from '../prisma.service';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { BullModule } from '@nestjs/bullmq';
import { GroupActivityController } from './activity/group-activity.controller';
import { GroupActivityService } from './activity/group-activity.service';
import { ActivityReminderProcessor } from './activity/activity-reminder.processor';
import { SessionAttendanceModule } from './attendance/session-attendance.module';
import { ChatClient } from '../clients/chat.client';
@Module({
  imports: [
    NotificationModule,
    SessionAttendanceModule,
    BullModule.registerQueue({
      name: 'activity-reminder-queue',
    }),
  ],
  controllers: [
    GroupController,
    GroupMemberController,
    GroupInternalController,
    GroupChatAccessInternalController,
    GroupActivityController,
  ],
  providers: [
    GroupService,
    PrismaService,
    JwtAuthGuard,
    AdminRoleGuard,
    GroupActivityService,
    ActivityReminderProcessor,
    ChatClient,
  ],
  exports: [GroupService, GroupActivityService],
})
export class GroupModule { }
