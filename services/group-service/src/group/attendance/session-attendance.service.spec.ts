import { Test, TestingModule } from '@nestjs/testing';
import { SessionAttendanceService } from './session-attendance.service';
import { PrismaService } from '../../prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { NotificationService } from '../../notification/notification.service';
import { UserService } from '../../user/user.service';

describe('SessionAttendanceService', () => {
  let service: SessionAttendanceService;
  let prisma: PrismaService;

  const mockPrisma: any = {
    $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    groupMember: {
      findUnique: jest.fn(),
    },
    groupActivity: {
      findUnique: jest.fn(),
    },
    sessionAttendance: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockNotificationService: any = {
    sendInAppNotification: jest.fn().mockResolvedValue(undefined),
  };

  const mockUserService: any = {
    getManyUsersByIds: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionAttendanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: UserService, useValue: mockUserService },
      ],
    }).compile();

    service = module.get<SessionAttendanceService>(SessionAttendanceService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('reportAbsence', () => {
    const groupId = 'group-uuid';
    const activityId = 'activity-uuid';
    const userId = 'user-uuid';
    const memberId = 'member-uuid';

    it('should successfully report absence if before the deadline', async () => {
      // Mock membership check
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: memberId,
        userId,
        groupId,
        role: 'MEMBER',
      });

      // Mock activity check (start time is 24 hours in the future)
      const startAt = new Date();
      startAt.setHours(startAt.getHours() + 24);
      mockPrisma.groupActivity.findUnique.mockResolvedValue({
        id: activityId,
        groupId,
        startAt,
        cancellationDeadlineHours: 12,
      });

      // Mock upsert
      mockPrisma.sessionAttendance.upsert.mockResolvedValue({
        id: 'attendance-uuid',
        activityId,
        memberId,
        status: 'ABSENT',
        guestCount: 0,
        guestStatus: null,
      });

      // Mock check not already absent
      mockPrisma.sessionAttendance.findUnique.mockResolvedValue(null);

      const result = await service.reportAbsence(groupId, activityId, userId);

      expect(result.status).toBe('ABSENT');
      expect(result.guestCount).toBe(0);
      expect(mockPrisma.sessionAttendance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            activityId_memberId: { activityId, memberId },
          },
          update: {
            status: 'ABSENT',
            guestCount: 0,
            guestStatus: null,
            pendingGuestCount: null,
          },
          create: {
            activityId,
            memberId,
            status: 'ABSENT',
            guestCount: 0,
            guestStatus: null,
            pendingGuestCount: null,
          },
        })
      );
    });

    it('should throw BadRequestException if already ABSENT', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: memberId,
        userId,
        groupId,
        role: 'MEMBER',
      });

      const startAt = new Date();
      startAt.setHours(startAt.getHours() + 24);
      mockPrisma.groupActivity.findUnique.mockResolvedValue({
        id: activityId,
        groupId,
        startAt,
        cancellationDeadlineHours: 12,
      });

      mockPrisma.sessionAttendance.findUnique.mockResolvedValue({
        id: 'attendance-uuid',
        status: 'ABSENT',
      });

      await expect(service.reportAbsence(groupId, activityId, userId)).rejects.toThrow(
        new BadRequestException('You are already marked as absent for this session')
      );
    });

    it('should throw BadRequestException if activity is COMPLETED or CANCELLED', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: memberId,
        userId,
        groupId,
        role: 'MEMBER',
      });

      mockPrisma.groupActivity.findUnique.mockResolvedValue({
        id: activityId,
        groupId,
        startAt: new Date(),
        status: 'CANCELLED',
      });

      await expect(service.reportAbsence(groupId, activityId, userId)).rejects.toThrow(
        new BadRequestException('Cannot report absence for completed or cancelled activities')
      );
    });

    it('should throw BadRequestException if after the deadline', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: memberId,
        userId,
        groupId,
        role: 'MEMBER',
      });

      // Mock activity (start time is 6 hours in the future, deadline is 12)
      const startAt = new Date();
      startAt.setHours(startAt.getHours() + 6);
      mockPrisma.groupActivity.findUnique.mockResolvedValue({
        id: activityId,
        groupId,
        startAt,
        cancellationDeadlineHours: 12,
      });

      await expect(
        service.reportAbsence(groupId, activityId, userId)
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow host to bypass the deadline when reporting absence', async () => {
      // Mock Host membership
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: memberId,
        userId,
        groupId,
        role: 'OWNER',
      });

      // Mock activity (past deadline)
      const startAt = new Date();
      startAt.setHours(startAt.getHours() + 6);
      mockPrisma.groupActivity.findUnique.mockResolvedValue({
        id: activityId,
        groupId,
        startAt,
        cancellationDeadlineHours: 12,
      });

      mockPrisma.sessionAttendance.findUnique.mockResolvedValue(null);

      mockPrisma.sessionAttendance.upsert.mockResolvedValue({
        id: 'attendance-uuid',
        status: 'ABSENT',
      });

      const result = await service.reportAbsence(groupId, activityId, userId);
      expect(result.status).toBe('ABSENT');
    });
  });

  describe('cancelAbsence', () => {
    const groupId = 'group-uuid';
    const activityId = 'activity-uuid';
    const userId = 'user-uuid';
    const memberId = 'member-uuid';

    it('should restore attendance status to ATTENDING', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: memberId,
        userId,
        groupId,
        role: 'MEMBER',
      });

      const startAt = new Date();
      startAt.setHours(startAt.getHours() + 24);
      mockPrisma.groupActivity.findUnique.mockResolvedValue({
        id: activityId,
        groupId,
        startAt,
      });

      mockPrisma.sessionAttendance.findUnique.mockResolvedValue({
        id: 'att-id',
        status: 'ABSENT',
      });

      mockPrisma.sessionAttendance.upsert.mockResolvedValue({
        id: 'attendance-uuid',
        status: 'ATTENDING',
      });

      const result = await service.cancelAbsence(groupId, activityId, userId);

      expect(result.status).toBe('ATTENDING');
      expect(mockPrisma.sessionAttendance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { status: 'ATTENDING' },
          create: { activityId, memberId, status: 'ATTENDING' },
        })
      );
    });

    it('should throw BadRequestException if already ATTENDING (not marked ABSENT)', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: memberId,
        userId,
        groupId,
        role: 'MEMBER',
      });

      const startAt = new Date();
      startAt.setHours(startAt.getHours() + 24);
      mockPrisma.groupActivity.findUnique.mockResolvedValue({
        id: activityId,
        groupId,
        startAt,
        cancellationDeadlineHours: 12,
      });

      // Already attending
      mockPrisma.sessionAttendance.findUnique.mockResolvedValue({
        id: 'attendance-uuid',
        status: 'ATTENDING',
      });

      await expect(service.cancelAbsence(groupId, activityId, userId)).rejects.toThrow(
        new BadRequestException('You are not marked as absent for this session')
      );
    });

    it('should throw BadRequestException if activity is COMPLETED or CANCELLED', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: memberId,
        userId,
        groupId,
        role: 'MEMBER',
      });

      mockPrisma.groupActivity.findUnique.mockResolvedValue({
        id: activityId,
        groupId,
        startAt: new Date(),
        status: 'COMPLETED',
      });

      await expect(service.cancelAbsence(groupId, activityId, userId)).rejects.toThrow(
        new BadRequestException('Cannot cancel absence for completed or cancelled activities')
      );
    });

    it('should throw BadRequestException if after the deadline', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: memberId,
        userId,
        groupId,
        role: 'MEMBER',
      });

      // Mock activity (start time is 6 hours in the future, deadline is 12)
      const startAt = new Date();
      startAt.setHours(startAt.getHours() + 6);
      mockPrisma.groupActivity.findUnique.mockResolvedValue({
        id: activityId,
        groupId,
        startAt,
        cancellationDeadlineHours: 12,
      });

      await expect(
        service.cancelAbsence(groupId, activityId, userId)
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow owner to cancel absence for another member and bypass deadline', async () => {
      mockPrisma.groupMember.findUnique
        .mockResolvedValueOnce({
          id: 'owner-member-uuid',
          userId: 'owner-user-uuid',
          groupId,
          role: 'OWNER',
        })
        .mockResolvedValueOnce({
          id: 'target-member-uuid',
          userId: 'target-user-uuid',
          groupId,
          role: 'MEMBER',
        });

      const startAt = new Date();
      startAt.setHours(startAt.getHours() + 6); // past deadline
      mockPrisma.groupActivity.findUnique.mockResolvedValue({
        id: activityId,
        groupId,
        startAt,
        cancellationDeadlineHours: 12,
      });

      mockPrisma.sessionAttendance.findUnique.mockResolvedValue({
        id: 'attendance-uuid',
        status: 'ABSENT',
      });

      mockPrisma.sessionAttendance.upsert.mockResolvedValue({
        id: 'attendance-uuid',
        status: 'ATTENDING',
      });

      const result = await service.cancelAbsence(groupId, activityId, 'owner-user-uuid', 'target-member-uuid');
      expect(result.status).toBe('ATTENDING');
    });

    it('should allow owner to cancel absence for another member even if activity is in the past', async () => {
      mockPrisma.groupMember.findUnique
        .mockResolvedValueOnce({
          id: 'owner-member-uuid',
          userId: 'owner-user-uuid',
          groupId,
          role: 'OWNER',
        })
        .mockResolvedValueOnce({
          id: 'target-member-uuid',
          userId: 'target-user-uuid',
          groupId,
          role: 'MEMBER',
        });

      const startAt = new Date();
      startAt.setHours(startAt.getHours() - 2); // 2 hours in the past
      mockPrisma.groupActivity.findUnique.mockResolvedValue({
        id: activityId,
        groupId,
        startAt,
        status: 'SCHEDULED',
      });

      mockPrisma.sessionAttendance.findUnique.mockResolvedValue({
        id: 'attendance-uuid',
        status: 'ABSENT',
      });

      mockPrisma.sessionAttendance.upsert.mockResolvedValue({
        id: 'attendance-uuid',
        status: 'ATTENDING',
      });

      const result = await service.cancelAbsence(groupId, activityId, 'owner-user-uuid', 'target-member-uuid');
      expect(result.status).toBe('ATTENDING');
    });

    it('should throw ForbiddenException if member attempts to cancel absence for another member', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({
        id: 'member-uuid',
        userId: 'member-user-uuid',
        groupId,
        role: 'MEMBER',
      });

      await expect(
        service.cancelAbsence(groupId, activityId, 'member-user-uuid', 'target-member-uuid')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('requestGuests', () => {
    const groupId = 'group-uuid';
    const activityId = 'activity-uuid';
    const userId = 'user-uuid';
    const memberId = 'member-uuid';

    it('should request guests and set status to PENDING if count > 0', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: memberId, userId, groupId });
      mockPrisma.groupActivity.findUnique.mockResolvedValue({ id: activityId, groupId });
      mockPrisma.sessionAttendance.findUnique.mockResolvedValue(null);
      mockPrisma.sessionAttendance.create.mockResolvedValue({
        activityId,
        memberId,
        guestCount: 2,
        guestStatus: 'PENDING',
      });

      const result = await service.requestGuests(groupId, activityId, userId, { guestCount: 2 });
      expect(result.guestCount).toBe(2);
      expect(result.guestStatus).toBe('PENDING');
      expect(mockPrisma.sessionAttendance.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if member is already marked ABSENT', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: memberId, userId, groupId });
      mockPrisma.groupActivity.findUnique.mockResolvedValue({ id: activityId, groupId });
      mockPrisma.sessionAttendance.findUnique.mockResolvedValue({ id: 'att-id', status: 'ABSENT' });

      await expect(service.requestGuests(groupId, activityId, userId, { guestCount: 2 })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if guestCount is 0 or negative', async () => {
      await expect(service.requestGuests(groupId, activityId, userId, { guestCount: 0 })).rejects.toThrow(BadRequestException);
      await expect(service.requestGuests(groupId, activityId, userId, { guestCount: -5 })).rejects.toThrow(BadRequestException);
    });

    it('should update pendingGuestCount (draft) if guest request is already APPROVED', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: memberId, userId, groupId });
      mockPrisma.groupActivity.findUnique.mockResolvedValue({ id: activityId, groupId });
      mockPrisma.sessionAttendance.findUnique.mockResolvedValue({ id: 'att-id', guestStatus: 'APPROVED', guestCount: 2 });
      mockPrisma.sessionAttendance.update.mockResolvedValue({ id: 'att-id', guestStatus: 'APPROVED', pendingGuestCount: 3 });

      const result = await service.requestGuests(groupId, activityId, userId, { guestCount: 3 });
      expect(result.pendingGuestCount).toBe(3);
      expect(mockPrisma.sessionAttendance.update).toHaveBeenCalledWith({
        where: { id: 'att-id' },
        data: { pendingGuestCount: 3 }
      });
    });

    it('should throw BadRequestException if new guestCount request equals current approved guestCount', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: memberId, userId, groupId });
      mockPrisma.groupActivity.findUnique.mockResolvedValue({ id: activityId, groupId });
      mockPrisma.sessionAttendance.findUnique.mockResolvedValue({ id: 'att-id', guestStatus: 'APPROVED', guestCount: 2 });

      await expect(
        service.requestGuests(groupId, activityId, userId, { guestCount: 2 })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if member requests guests past the deadline', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: memberId, userId, groupId, role: 'MEMBER' });
      
      const startAt = new Date();
      startAt.setHours(startAt.getHours() + 6); // past deadline
      mockPrisma.groupActivity.findUnique.mockResolvedValue({
        id: activityId,
        groupId,
        startAt,
        cancellationDeadlineHours: 12,
      });

      await expect(
        service.requestGuests(groupId, activityId, userId, { guestCount: 2 })
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow owner to request guests past the deadline', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: memberId, userId, groupId, role: 'OWNER' });
      
      const startAt = new Date();
      startAt.setHours(startAt.getHours() + 6); // past deadline
      mockPrisma.groupActivity.findUnique.mockResolvedValue({
        id: activityId,
        groupId,
        startAt,
        cancellationDeadlineHours: 12,
      });

      mockPrisma.sessionAttendance.findUnique.mockResolvedValue(null);
      mockPrisma.sessionAttendance.create.mockResolvedValue({
        activityId,
        memberId,
        guestCount: 2,
        guestStatus: 'PENDING',
      });

      const result = await service.requestGuests(groupId, activityId, userId, { guestCount: 2 });
      expect(result.guestCount).toBe(2);
    });
  });

  describe('cancelGuests', () => {
    const groupId = 'group-uuid';
    const activityId = 'activity-uuid';
    const userId = 'user-uuid';
    const memberIdToCancel = 'member-uuid';

    it('should allow host (OWNER) to cancel guest request', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 'host-member-id', userId, groupId, role: 'OWNER' });
      mockPrisma.groupActivity.findUnique.mockResolvedValue({ id: activityId, groupId });
      mockPrisma.sessionAttendance.findUnique.mockResolvedValue({
        id: 'att-id',
        guestCount: 2,
        guestStatus: 'APPROVED',
        member: { userId: 'member-user-id' },
        activity: { title: 'Weekend Practice' }
      });
      mockPrisma.sessionAttendance.update.mockResolvedValue({ id: 'att-id', guestCount: 0, guestStatus: null });

      const result = await service.cancelGuests(groupId, activityId, memberIdToCancel, userId);
      expect(result.guestCount).toBe(0);
      expect(result.guestStatus).toBeNull();
      expect(mockPrisma.sessionAttendance.update).toHaveBeenCalledWith({
        where: { id: 'att-id' },
        data: { guestCount: 0, guestStatus: null, pendingGuestCount: null }
      });
    });

    it('should throw ForbiddenException if caller is not OWNER', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 'normal-member-id', userId, groupId, role: 'MEMBER' });

      await expect(service.cancelGuests(groupId, activityId, memberIdToCancel, userId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reviewGuests', () => {
    const groupId = 'group-uuid';
    const activityId = 'activity-uuid';
    const userId = 'user-uuid';
    const memberId = 'member-uuid';

    it('should approve guest request if called by host', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 'host-member-id', userId, groupId, role: 'OWNER' });
      mockPrisma.groupActivity.findUnique.mockResolvedValue({ id: activityId, groupId });
      mockPrisma.sessionAttendance.findUnique.mockResolvedValue({
        id: 'att-id',
        guestCount: 2,
        guestStatus: 'PENDING',
        member: { userId: 'member-user-id' },
        activity: { title: 'Weekend Practice' }
      });
      mockPrisma.sessionAttendance.update.mockResolvedValue({ id: 'att-id', guestCount: 2, guestStatus: 'APPROVED' });

      const result = await service.reviewGuests(groupId, activityId, memberId, userId, { status: 'APPROVED' as any });
      expect(result.guestStatus).toBe('APPROVED');
    });

    it('should throw ForbiddenException if caller is not the owner', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 'member-id', userId, groupId, role: 'MEMBER' });

      await expect(service.reviewGuests(groupId, activityId, memberId, userId, { status: 'APPROVED' as any })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listGuestRequests', () => {
    const groupId = 'group-uuid';
    const activityId = 'activity-uuid';
    const userId = 'user-uuid';

    it('should filter guest requests by status REVISION', async () => {
      mockPrisma.groupMember.findUnique.mockResolvedValue({ id: 'member-id', userId, groupId, role: 'MEMBER' });
      mockPrisma.groupActivity.findUnique.mockResolvedValue({ id: activityId, groupId });
      mockPrisma.sessionAttendance.findMany = jest.fn().mockResolvedValue([
        {
          id: 'att-id',
          memberId: 'member-id',
          guestCount: 2,
          guestStatus: 'APPROVED',
          pendingGuestCount: 3,
          reportedAt: new Date(),
          member: { userId: 'member-user-id', role: 'MEMBER' },
        },
      ]);
      mockUserService.getManyUsersByIds.mockResolvedValue([
        { id: 'member-user-id', name: 'Alice', email: 'alice@example.com' },
      ]);

      const result = await service.listGuestRequests(groupId, activityId, userId, 'REVISION');
      expect(result.length).toBe(1);
      expect(result[0].pendingGuestCount).toBe(3);
      expect(mockPrisma.sessionAttendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pendingGuestCount: { not: null },
          }),
        })
      );
    });
  });
});
