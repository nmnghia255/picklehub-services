import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateGroupActivityDto } from './dto/create-group-activity.dto';
import { UpdateGroupActivityDto } from './dto/update-group-activity.dto';
import { ListGroupActivitiesQueryDto, ActivityFilterType } from './dto/list-group-activities.query.dto';
import { ListMembersQueryDto } from '../dto/list-members.query.dto';
import { GroupMemberRole, GroupActivityStatus, Prisma } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { GroupService } from '../group.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class GroupActivityService implements OnModuleInit {
  private readonly logger = new Logger(GroupActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('activity-reminder-queue') private readonly reminderQueue: Queue,
    private readonly groupService: GroupService,
    private readonly notificationService: NotificationService,
  ) { }

  async onModuleInit() {
    this.logger.log('Running Auto-Recovery for Activity Reminders...');
    try {
      const pendingActivities = await this.prisma.groupActivity.findMany({
        where: {
          status: { not: GroupActivityStatus.CANCELLED },
          isReminderSent: false,
          remindAt: { gt: new Date() },
        },
      });

      if (pendingActivities.length > 0) {
        this.logger.log(`Found ${pendingActivities.length} pending reminders. Re-queueing...`);
        let queuedCount = 0;

        for (const activity of pendingActivities) {
          const delay = activity.remindAt!.getTime() - Date.now();
          if (delay > 0) {
            await this.reminderQueue.add(
              'send-reminder',
              { activityId: activity.id, groupId: activity.groupId },
              { jobId: activity.id, delay },
            );
            queuedCount++;
          }
        }
        this.logger.log(`Successfully re-queued ${queuedCount} reminders.`);
      } else {
        this.logger.log('No pending reminders found.');
      }
    } catch (error) {
      this.logger.error('Failed to run Auto-Recovery for Activity Reminders', error);
    }
  }

  private async checkGroupRole(userId: string, groupId: string, requiredRoles: GroupMemberRole[] = []) {
    const member = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });

    if (!member) {
      // Also check if platform admin or something, but following standard group logic:
      throw new ForbiddenException('You are not a member of this group');
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(member.role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }

    return member;
  }

  async createActivity(userId: string, groupId: string, dto: CreateGroupActivityDto) {
    await this.checkGroupRole(userId, groupId, [GroupMemberRole.OWNER]);

    if (dto.startAt <= new Date()) {
      throw new BadRequestException('startAt must be a future time');
    }

    if (dto.startAt >= dto.endAt) {
      throw new BadRequestException('startAt must be before endAt');
    }

    if (dto.remindAt && dto.remindAt <= new Date()) {
      throw new BadRequestException('remindAt must be a future time');
    }

    if (dto.courtBookingId) {
      const booking = await this.prisma.groupCourtBooking.findUnique({
        where: {
          id: dto.courtBookingId,
        },
      });

      if (!booking) {
        throw new BadRequestException('Court booking does not exist or is not linked to group');
      }
    }

    const activity = await this.prisma.groupActivity.create({
      data: {
        groupId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        activityType: dto.activityType,
        startAt: dto.startAt,
        endAt: dto.endAt,
        remindAt: dto.remindAt,
        cancellationDeadlineHours: dto.cancellationDeadlineHours,
        courtBookingId: dto.courtBookingId,
        createdById: userId,
      },
    });

    if (activity.remindAt) {
      const delay = activity.remindAt.getTime() - Date.now();
      if (delay > 0) {
        await this.reminderQueue.add(
          'send-reminder',
          { activityId: activity.id, groupId: activity.groupId },
          { jobId: activity.id, delay },
        );
      }
    }

    const user = await this.groupService.getUserById(activity.createdById);

    // Send group feed notification for the new activity
    await this.notificationService.sendGroupFeedNotification(
      groupId,
      'Lịch sinh hoạt mới',
      `Trưởng nhóm đã lên lịch buổi sinh hoạt: "${activity.title}" diễn ra vào lúc ${new Date(activity.startAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`
    ).catch(err => this.logger.error('Failed to send notification for new activity', err));

    return {
      ...activity,
      creator: user ? { id: user.id, name: user.name, email: user.email } : null,
    };
  }

  async updateActivity(userId: string, groupId: string, activityId: string, dto: UpdateGroupActivityDto) {
    await this.checkGroupRole(userId, groupId, [GroupMemberRole.OWNER]);

    const existingActivity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
    });

    if (!existingActivity || existingActivity.groupId !== groupId) {
      throw new NotFoundException('Group activity not found');
    }

    // Validate dates if they are being updated
    if (dto.startAt && dto.startAt <= new Date()) {
      throw new BadRequestException('startAt must be a future time');
    }

    const startAt = dto.startAt || existingActivity.startAt;
    const endAt = dto.endAt || existingActivity.endAt;

    if (startAt >= endAt) {
      throw new BadRequestException('startAt must be before endAt');
    }

    if (dto.remindAt !== undefined && dto.remindAt !== null && dto.remindAt <= new Date()) {
      throw new BadRequestException('remindAt must be a future time');
    }

    let isReminderSent = existingActivity.isReminderSent;
    // If remindAt is changing, reset isReminderSent
    if (dto.remindAt !== undefined && dto.remindAt !== existingActivity.remindAt) {
      isReminderSent = false;
    }

    const dataToUpdate: any = {
      ...dto,
      isReminderSent,
    };
    if (dto.status === GroupActivityStatus.CANCELLED) {
      dataToUpdate.courtBooking = { disconnect: true };
    }

    const updatedActivity = await this.prisma.groupActivity.update({
      where: { id: activityId },
      data: dataToUpdate,
    });

    // Handle BullMQ Job
    const statusChangedToCancelled = dto.status === GroupActivityStatus.CANCELLED && existingActivity.status !== GroupActivityStatus.CANCELLED;
    const remindAtChanged = dto.remindAt !== undefined && dto.remindAt !== existingActivity.remindAt;

    if (statusChangedToCancelled || remindAtChanged) {
      // Remove old job
      await this.reminderQueue.remove(activityId);
    }

    // Add new job if necessary
    if (
      updatedActivity.status !== GroupActivityStatus.CANCELLED &&
      updatedActivity.remindAt &&
      !updatedActivity.isReminderSent
    ) {
      const delay = updatedActivity.remindAt.getTime() - Date.now();
      if (delay > 0) {
        await this.reminderQueue.add(
          'send-reminder',
          { activityId: updatedActivity.id, groupId: updatedActivity.groupId },
          { jobId: updatedActivity.id, delay },
        );
      }
    }

    if (statusChangedToCancelled) {
      await this.notificationService.sendGroupFeedNotification(
        groupId,
        'Buổi sinh hoạt bị hủy',
        `Trưởng nhóm đã hủy buổi sinh hoạt: "${updatedActivity.title}" diễn ra vào lúc ${new Date(updatedActivity.startAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`
      ).catch(err => this.logger.error('Failed to send cancellation notification', err));
    }

    const user = await this.groupService.getUserById(updatedActivity.createdById);

    return {
      ...updatedActivity,
      creator: user ? { id: user.id, name: user.name, email: user.email } : null,
    };
  }

  async deleteActivity(userId: string, groupId: string, activityId: string) {
    await this.checkGroupRole(userId, groupId, [GroupMemberRole.OWNER]);

    const existingActivity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
    });

    if (!existingActivity || existingActivity.groupId !== groupId) {
      throw new NotFoundException('Group activity not found');
    }

    await this.prisma.groupActivity.delete({
      where: { id: activityId },
    });

    // Remove job from queue
    await this.reminderQueue.remove(activityId);

    return { message: 'Activity deleted successfully' };
  }

  async listActivities(userId: string, groupId: string, query: ListGroupActivitiesQueryDto) {
    await this.checkGroupRole(userId, groupId); // Any member can view

    const { page = 1, limit = 10, type, hasExpense } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.GroupActivityWhereInput = {
      groupId,
    };

    if (type === ActivityFilterType.UPCOMING) {
      where.startAt = { gte: new Date() };
    } else if (type === ActivityFilterType.PAST) {
      where.startAt = { lt: new Date() };
    }

    if (hasExpense === true) {
      where.expenses = { some: {} };
    } else if (hasExpense === false) {
      where.expenses = { none: {} };
    }

    const [total, activities] = await this.prisma.$transaction([
      this.prisma.groupActivity.count({ where }),
      this.prisma.groupActivity.findMany({
        where,
        orderBy: { startAt: type === ActivityFilterType.PAST ? 'desc' : 'asc' },
        skip,
        take: limit,
        include: {
          expenses: {
            select: { id: true, title: true, totalAmount: true }
          },
          courtBooking: true,
        }
      }),
    ]);

    const activityIds = activities.map((a) => a.id);
    const attendances = activityIds.length > 0
      ? await this.prisma.sessionAttendance.findMany({
        where: { activityId: { in: activityIds } },
        select: { activityId: true, status: true, guestCount: true, guestStatus: true },
      })
      : [];

    const absentCountsMap = new Map<string, number>();
    const guestCountsMap = new Map<string, number>();
    for (const att of attendances) {
      if (att.status === 'ABSENT') {
        absentCountsMap.set(att.activityId, (absentCountsMap.get(att.activityId) ?? 0) + 1);
      }
      if (att.guestStatus === 'APPROVED' && att.guestCount > 0) {
        guestCountsMap.set(att.activityId, (guestCountsMap.get(att.activityId) ?? 0) + att.guestCount);
      }
    }

    const totalMembers = await this.prisma.groupMember.count({ where: { groupId } });

    // Fetch caller's attendances for these activities to determine myAttendance state
    const callerMember = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    const callerMemberId = callerMember?.id;

    const callerAttendances = callerMemberId && activityIds.length > 0
      ? await this.prisma.sessionAttendance.findMany({
        where: {
          activityId: { in: activityIds },
          memberId: callerMemberId,
        },
      })
      : [];

    const myAttendanceMap = new Map<string, any>();
    for (const att of callerAttendances) {
      myAttendanceMap.set(att.activityId, {
        status: att.status,
        guestCount: att.guestCount,
        guestStatus: att.guestStatus,
        pendingGuestCount: att.pendingGuestCount,
      });
    }

    const userIds = activities.map((a) => a.createdById);
    const usersMap = await this.groupService.getUsersMapByIds(userIds);

    const data = activities.map((a) => {
      const user = usersMap.get(a.createdById);
      const linkedExpense = a.expenses && a.expenses.length > 0 ? a.expenses[0] : null;
      const absentCount = absentCountsMap.get(a.id) ?? 0;
      const attendingGuestCount = guestCountsMap.get(a.id) ?? 0;
      const attendingMemberCount = Math.max(0, totalMembers - absentCount);

      const myAttendance = myAttendanceMap.get(a.id) ?? {
        status: 'ATTENDING',
        guestCount: 0,
        guestStatus: null,
        pendingGuestCount: null,
      };

      return {
        id: a.id,
        groupId: a.groupId,
        title: a.title,
        description: a.description,
        location: a.location,
        activityType: a.activityType,
        startAt: a.startAt,
        endAt: a.endAt,
        remindAt: a.remindAt,
        status: a.status,
        isReminderSent: a.isReminderSent,
        createdById: a.createdById,
        cancellationDeadlineHours: a.cancellationDeadlineHours,
        courtBookingId: a.courtBookingId,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        creator: user ? { id: user.id, name: user.name, email: user.email } : null,
        hasExpense: linkedExpense !== null,
        expense: linkedExpense,
        courtBooking: a.courtBooking,
        attendingMemberCount,
        attendingGuestCount,
        myAttendance,
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getActivity(userId: string, groupId: string, activityId: string) {
    await this.checkGroupRole(userId, groupId);

    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
      include: {
        courtBooking: true,
      },
    });

    if (!activity || activity.groupId !== groupId) {
      throw new NotFoundException('Group activity not found');
    }

    // Calculate participant counts
    const absentCount = await this.prisma.sessionAttendance.count({
      where: {
        activityId,
        status: 'ABSENT',
      },
    });

    const guestCountAggregate = await this.prisma.sessionAttendance.aggregate({
      where: {
        activityId,
        guestStatus: 'APPROVED',
      },
      _sum: {
        guestCount: true,
      },
    });

    const totalMembers = await this.prisma.groupMember.count({ where: { groupId } });
    const attendingGuestCount = guestCountAggregate._sum.guestCount ?? 0;
    const attendingMemberCount = Math.max(0, totalMembers - absentCount);

    const callerMember = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });

    let myAttendance: {
      status: string;
      guestCount: number;
      guestStatus: string | null;
      pendingGuestCount: number | null;
    } = {
      status: 'ATTENDING',
      guestCount: 0,
      guestStatus: null,
      pendingGuestCount: null,
    };

    if (callerMember) {
      const att = await this.prisma.sessionAttendance.findUnique({
        where: {
          activityId_memberId: { activityId, memberId: callerMember.id },
        },
      });
      if (att) {
        myAttendance = {
          status: att.status,
          guestCount: att.guestCount,
          guestStatus: att.guestStatus,
          pendingGuestCount: att.pendingGuestCount,
        };
      }
    }

    const user = await this.groupService.getUserById(activity.createdById);

    return {
      ...activity,
      creator: user ? { id: user.id, name: user.name, email: user.email } : null,
      attendingMemberCount,
      attendingGuestCount,
      myAttendance,
    };
  }

  async getActivityMembers(
    userId: string,
    groupId: string,
    activityId: string,
    query: ListMembersQueryDto,
  ) {
    await this.checkGroupRole(userId, groupId);

    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
    });
    if (!activity || activity.groupId !== groupId) {
      throw new NotFoundException('Group activity not found');
    }

    const members = await this.prisma.groupMember.findMany({
      where: { groupId },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    const userIds = members.map((m) => m.userId);
    const usersMap = await this.groupService.getUsersMapByIds(userIds);

    let filteredMembers = members;
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredMembers = members.filter((m) => {
        const user = usersMap.get(m.userId);
        if (!user) return false;
        return (
          user.name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower)
        );
      });
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, Math.min(100, query.limit ?? 10));
    const skip = (page - 1) * limit;

    const paginatedMembers = filteredMembers.slice(skip, skip + limit);

    const attendances = paginatedMembers.length > 0
      ? await this.prisma.sessionAttendance.findMany({
        where: {
          activityId,
          memberId: { in: paginatedMembers.map((m) => m.id) },
        },
      })
      : [];
    const attendanceMap = new Map(attendances.map((att) => [att.memberId, att]));

    const data = paginatedMembers.map((m) => {
      const userProfile = usersMap.get(m.userId);
      const att = attendanceMap.get(m.id);

      return {
        memberId: m.id,
        userId: m.userId,
        name: userProfile?.name ?? null,
        email: userProfile?.email ?? '',
        avatarUrl: userProfile?.avatarUrl ?? null,
        role: m.role.toLowerCase(),
        attendanceStatus: att?.status ?? 'ATTENDING',
        guestCount: att?.guestCount ?? 0,
        guestStatus: att?.guestStatus ?? null,
        pendingGuestCount: att?.pendingGuestCount ?? null,
      };
    });

    const total = filteredMembers.length;

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }
}
