import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RequestGuestDto } from './dto/request-guest.dto';
import { ReviewGuestDto } from './dto/review-guest.dto';
import { GroupMemberRole } from '@prisma/client';
import { NotificationService } from '../../notification/notification.service';
import { UserService } from '../../user/user.service';

@Injectable()
export class SessionAttendanceService {
  private readonly logger = new Logger(SessionAttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
  ) { }

  /**
   * Report absence for a session activity.
   * If past the deadline, throws BadRequestException unless the caller is Owner or Admin.
   * Automatically resets guest count and guest status.
   */
  async reportAbsence(groupId: string, activityId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
    });
    if (!activity || activity.groupId !== groupId) {
      throw new NotFoundException('Activity not found in this group');
    }

    const now = new Date();
    const deadlineMs = (activity.cancellationDeadlineHours ?? 12) * 60 * 60 * 1000;
    const isAfterDeadline = now.getTime() + deadlineMs > new Date(activity.startAt).getTime();
    const isOwner = member.role === 'OWNER';

    if (activity.status === 'COMPLETED' || activity.status === 'CANCELLED') {
      throw new BadRequestException('Cannot report absence for completed or cancelled activities');
    }

    if (isAfterDeadline && !isOwner) {
      throw new BadRequestException('Cannot report absence past the cancellation deadline');
    }

    const existing = await this.prisma.sessionAttendance.findUnique({
      where: {
        activityId_memberId: { activityId, memberId: member.id },
      },
    });

    if (existing && existing.status === 'ABSENT') {
      throw new BadRequestException('You are already marked as absent for this session');
    }

    return this.prisma.sessionAttendance.upsert({
      where: {
        activityId_memberId: { activityId, memberId: member.id },
      },
      update: {
        status: 'ABSENT',
        guestCount: 0,
        guestStatus: null,
        pendingGuestCount: null,
      },
      create: {
        activityId,
        memberId: member.id,
        status: 'ABSENT',
        guestCount: 0,
        guestStatus: null,
        pendingGuestCount: null,
      },
    });
  }

  /**
   * Cancel absence report, reverting status back to ATTENDING.
   * Cannot be performed once the activity has started.
   */
  async cancelAbsence(groupId: string, activityId: string, userId: string, memberId?: string) {
    const callerMember = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!callerMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    let targetMember = callerMember;
    if (memberId && memberId !== callerMember.id) {
      if (callerMember.role !== 'OWNER') {
        throw new ForbiddenException('Only the group OWNER can cancel absence for other members');
      }
      const foundTarget = await this.prisma.groupMember.findUnique({
        where: { id: memberId },
      });
      if (!foundTarget || foundTarget.groupId !== groupId) {
        throw new NotFoundException('Member not found in this group');
      }
      targetMember = foundTarget;
    }

    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
    });
    if (!activity || activity.groupId !== groupId) {
      throw new NotFoundException('Activity not found in this group');
    }

    const now = new Date();
    const deadlineMs = (activity.cancellationDeadlineHours ?? 12) * 60 * 60 * 1000;
    const isAfterDeadline = now.getTime() + deadlineMs > new Date(activity.startAt).getTime();
    const callerIsOwner = callerMember.role === 'OWNER';

    if (activity.status === 'COMPLETED' || activity.status === 'CANCELLED') {
      throw new BadRequestException('Cannot cancel absence for completed or cancelled activities');
    }

    if (new Date(activity.startAt).getTime() < now.getTime() && !callerIsOwner) {
      throw new BadRequestException('Cannot cancel absence for past or started activities');
    }

    if (isAfterDeadline && !callerIsOwner) {
      throw new BadRequestException('Cannot cancel absence past the cancellation deadline');
    }

    const existing = await this.prisma.sessionAttendance.findUnique({
      where: {
        activityId_memberId: { activityId, memberId: targetMember.id },
      },
    });

    if (!existing || existing.status === 'ATTENDING') {
      const errMsg = memberId && memberId !== callerMember.id
        ? 'Member is not marked as absent for this session'
        : 'You are not marked as absent for this session';
      throw new BadRequestException(errMsg);
    }

    return this.prisma.sessionAttendance.upsert({
      where: {
        activityId_memberId: { activityId, memberId: targetMember.id },
      },
      update: {
        status: 'ATTENDING',
      },
      create: {
        activityId,
        memberId: targetMember.id,
        status: 'ATTENDING',
      },
    });
  }

  /**
   * List all guest requests for a session, with optional status filter.
   * Accessible by any group member; primarily used by Host to review pending requests.
   */
  async listGuestRequests(
    groupId: string,
    activityId: string,
    userId: string,
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVISION',
  ) {
    // Verify caller is a member of the group
    const member = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
    });
    if (!activity || activity.groupId !== groupId) {
      throw new NotFoundException('Activity not found in this group');
    }

    const where: any = {
      activityId,
    };

    if (status === 'PENDING') {
      where.guestStatus = 'PENDING';
      where.pendingGuestCount = null;
      where.guestCount = { gt: 0 };
    } else if (status === 'REVISION') {
      where.pendingGuestCount = { not: null };
    } else if (status) {
      where.guestStatus = status as any;
      where.guestCount = { gt: 0 };
    } else {
      where.OR = [
        { guestCount: { gt: 0 } },
        { pendingGuestCount: { not: null } },
      ];
    }

    const records = await this.prisma.sessionAttendance.findMany({
      where,
      include: {
        member: {
          select: { id: true, userId: true, role: true },
        },
      },
      orderBy: { reportedAt: 'desc' },
    });

    const userIds = records.map((r) => r.member.userId);
    const users = userIds.length > 0 ? await this.userService.getManyUsersByIds(userIds) : [];
    const usersMap = new Map(users.map((u) => [u.id, u]));

    return records.map((r) => {
      const userProfile = usersMap.get(r.member.userId);
      return {
        memberId: r.memberId,
        userId: r.member.userId,
        role: r.member.role,
        name: userProfile?.name ?? null,
        email: userProfile?.email ?? '',
        avatarUrl: userProfile?.avatarUrl ?? null,
        guestCount: r.guestCount,
        guestStatus: r.guestStatus,
        pendingGuestCount: r.pendingGuestCount,
        reportedAt: r.reportedAt,
        requester: {
          id: r.member.userId,
          name: userProfile?.name ?? null,
          email: userProfile?.email ?? '',
          avatarUrl: userProfile?.avatarUrl ?? null,
        },
      };
    });
  }

  /**
   * Request guest attendance for a session.
   */
  async requestGuests(groupId: string, activityId: string, userId: string, dto: RequestGuestDto) {
    if (dto.guestCount <= 0) {
      throw new BadRequestException('Guest count must be greater than 0');
    }

    const member = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!member) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
    });
    if (!activity || activity.groupId !== groupId) {
      throw new NotFoundException('Activity not found in this group');
    }

    const now = new Date();
    const deadlineMs = (activity.cancellationDeadlineHours ?? 12) * 60 * 60 * 1000;
    const isAfterDeadline = now.getTime() + deadlineMs > new Date(activity.startAt).getTime();
    const isOwner = member.role === 'OWNER';

    if (activity.status === 'COMPLETED' || activity.status === 'CANCELLED') {
      throw new BadRequestException('Cannot request guests for completed or cancelled activities');
    }

    if (new Date(activity.startAt).getTime() < now.getTime()) {
      throw new BadRequestException('Cannot request guests for past or started activities');
    }

    if (isAfterDeadline && !isOwner) {
      throw new BadRequestException('Cannot request guests past the cancellation deadline');
    }

    let attendance = await this.prisma.sessionAttendance.findUnique({
      where: { activityId_memberId: { activityId, memberId: member.id } },
    });

    if (!attendance) {
      // First-ever request: create record with guestCount + PENDING
      attendance = await this.prisma.sessionAttendance.create({
        data: {
          activityId,
          memberId: member.id,
          status: 'ATTENDING',
          guestCount: dto.guestCount,
          guestStatus: 'PENDING',
          pendingGuestCount: null,
        },
      });
    } else {
      if (attendance.status === 'ABSENT') {
        throw new BadRequestException('Cannot request guests for a session you reported absent from');
      }

      if (attendance.guestStatus === 'APPROVED') {
        if (dto.guestCount === attendance.guestCount) {
          throw new BadRequestException('New guest count request must be different from current approved guest count');
        }
        // Official approved exists — store new request as a draft; keep official intact
        attendance = await this.prisma.sessionAttendance.update({
          where: { id: attendance.id },
          data: { pendingGuestCount: dto.guestCount },
        });
      } else {
        // No official yet (PENDING / REJECTED) — update directly
        attendance = await this.prisma.sessionAttendance.update({
          where: { id: attendance.id },
          data: {
            guestCount: dto.guestCount,
            guestStatus: 'PENDING',
            pendingGuestCount: null,
          },
        });
      }
    }
    return attendance;
  }

  /**
   * Cancel a member's guest request (OWNER only).
   * Resets guestCount to 0 and guestStatus to null.
   */
  async cancelGuests(groupId: string, activityId: string, memberIdToCancel: string, userId: string) {
    const caller = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!caller || caller.role !== GroupMemberRole.OWNER) {
      throw new ForbiddenException('Only the group OWNER can cancel guest requests');
    }

    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
    });
    if (!activity || activity.groupId !== groupId) {
      throw new NotFoundException('Activity not found in this group');
    }

    const attendance = await this.prisma.sessionAttendance.findUnique({
      where: { activityId_memberId: { activityId, memberId: memberIdToCancel } },
      include: {
        member: true,
        activity: true,
      },
    });
    if (!attendance) {
      throw new NotFoundException('Attendance record not found for the specified member');
    }

    const updated = await this.prisma.sessionAttendance.update({
      where: { id: attendance.id },
      data: {
        guestCount: 0,
        guestStatus: null,
        pendingGuestCount: null,
      },
    });

    await this.notificationService.sendInAppNotification(
      [attendance.member.userId],
      'Yêu cầu khách mời bị hủy',
      `Yêu cầu khách mời cho buổi chơi "${attendance.activity.title}" đã bị hủy bởi Trưởng nhóm.`
    ).catch(err => this.logger.error('Failed to send guest cancellation notification', err));

    return updated;
  }

  /**
   * Review guest requests (OWNER only).
   */
  async reviewGuests(
    groupId: string,
    activityId: string,
    memberIdToReview: string,
    userId: string,
    dto: ReviewGuestDto,
  ) {
    const caller = await this.prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!caller || caller.role !== GroupMemberRole.OWNER) {
      throw new ForbiddenException('Only the group OWNER can review guest requests');
    }

    const activity = await this.prisma.groupActivity.findUnique({
      where: { id: activityId },
    });
    if (!activity || activity.groupId !== groupId) {
      throw new NotFoundException('Activity not found in this group');
    }

    const attendance = await this.prisma.sessionAttendance.findUnique({
      where: { activityId_memberId: { activityId, memberId: memberIdToReview } },
      include: {
        member: true,
        activity: true,
      },
    });
    if (!attendance) {
      throw new NotFoundException('Attendance record not found for the specified member');
    }
    const hasPending = attendance.pendingGuestCount != null;
    if (!hasPending && attendance.guestCount <= 0) {
      throw new BadRequestException('No guest requests found for this member');
    }

    let updatedData: any;
    if (hasPending && dto.status === 'APPROVED') {
      // Promote the pending draft to official approved
      updatedData = {
        guestCount: attendance.pendingGuestCount,
        guestStatus: 'APPROVED',
        pendingGuestCount: null,
      };
    } else if (hasPending && dto.status === 'REJECTED') {
      // Discard the pending draft; keep existing official approved intact
      updatedData = { pendingGuestCount: null };
    } else {
      // Normal first-time review (no pending draft)
      updatedData = { guestStatus: dto.status };
    }

    const updated = await this.prisma.sessionAttendance.update({
      where: { id: attendance.id },
      data: updatedData,
    });

    const reviewedCount = hasPending ? attendance.pendingGuestCount : attendance.guestCount;
    const actionLabel = dto.status === 'APPROVED' ? 'được phê duyệt' : 'bị từ chối';
    await this.notificationService.sendInAppNotification(
      [attendance.member.userId],
      'Cập nhật yêu cầu khách mời',
      `Yêu cầu dẫn ${reviewedCount} khách cho buổi chơi "${attendance.activity.title}" đã ${actionLabel} bởi Trưởng nhóm.`
    ).catch(err => this.logger.error('Failed to send guest review notification', err));

    return updated;
  }
}
