import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { RefereesService } from './referees.service';
import { PrismaService } from '../prisma/prisma.service';
import { MatchClient } from '../clients/match.client';
import { UserClient } from '../clients/user.client';
import { NotificationClient } from '../clients/notification.client';

describe('RefereesService', () => {
  let service: RefereesService;
  let prisma: any;
  let matchClient: any;
  let userClient: any;
  let notificationClient: any;

  beforeEach(async () => {
    prisma = {
      tournament: { findUnique: jest.fn().mockResolvedValue({ id: 1, name: 'Test Cup' }) },
      tournamentReferee: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
      tournamentRefereeInvitation: { findFirst: jest.fn(), upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      match: { findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      $transaction: jest.fn(async (arg: any) => {
        if (typeof arg === 'function') return arg(prisma);
        return Promise.all(arg);
      }),
    };

    matchClient = {
      updateMatch: jest.fn().mockResolvedValue(true),
    };

    userClient = {
      getUserProfile: jest.fn(),
      searchUsers: jest.fn(),
    };

    notificationClient = {
      sendEmail: jest.fn().mockResolvedValue(true),
      sendInAppNotification: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefereesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MatchClient, useValue: matchClient },
        { provide: UserClient, useValue: userClient },
        { provide: NotificationClient, useValue: notificationClient },
      ],
    }).compile();
    service = module.get(RefereesService);
  });

  describe('enrollReferee', () => {
    it('throws NotFoundException if tournament does not exist', async () => {
      prisma.tournament.findUnique.mockResolvedValue(null);
      await expect(service.enrollReferee(1, { refereeId: 'ref-1' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if referee is already enrolled', async () => {
      prisma.tournamentReferee.findUnique.mockResolvedValue({ id: 5 });
      await expect(service.enrollReferee(1, { refereeId: 'ref-1' })).rejects.toThrow(BadRequestException);
    });

    it('fetches profile and enrolls successfully', async () => {
      prisma.tournamentReferee.findUnique.mockResolvedValue(null);
      userClient.getUserProfile.mockResolvedValue({ name: 'Fetched Name', email: 'ref@mail.com', avatar: 'http://avatar' });
      prisma.tournamentReferee.create.mockImplementation((args: any) => args.data);

      const res = await service.enrollReferee(1, { refereeId: 'ref-1' });
      expect(res.refereeName).toBe('Fetched Name');
      expect(res.refereeEmail).toBe('ref@mail.com');
      expect(res.refereeAvatar).toBe('http://avatar');
    });
  });

  describe('unenrollReferee', () => {
    it('throws NotFoundException if referee not enrolled', async () => {
      prisma.tournamentReferee.findUnique.mockResolvedValue(null);
      await expect(service.unenrollReferee(1, 'ref-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if referee has active assignments', async () => {
      prisma.tournamentReferee.findUnique.mockResolvedValue({ id: 5 });
      prisma.match.findFirst.mockResolvedValue({ id: 100 }); // Active assignment
      await expect(service.unenrollReferee(1, 'ref-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('assignReferee', () => {
    it('throws BadRequestException if referee is not enrolled', async () => {
      prisma.tournamentReferee.findUnique.mockResolvedValue(null);
      await expect(service.assignReferee(1, 10, 'ref-1')).rejects.toThrow(BadRequestException);
    });

    it('assigns referee successfully if enrolled', async () => {
      prisma.tournamentReferee.findUnique.mockResolvedValue({ refereeName: 'Enrolled Referee' });
      prisma.match.findFirst.mockResolvedValue({ id: 10, externalMatchId: 'ext-id' });
      prisma.match.update.mockResolvedValue({ id: 10, refereeId: 'ref-1', refereeName: 'Enrolled Referee' });

      const res = await service.assignReferee(1, 10, 'ref-1');
      expect(res.refereeName).toBe('Enrolled Referee');
      expect(matchClient.updateMatch).toHaveBeenCalledWith('ext-id', { refereeId: 'ref-1' }, undefined);
    });
  });


  describe('inviteReferee', () => {
    it('sends invitation successfully', async () => {
      userClient.searchUsers.mockResolvedValue({ data: [] });
      prisma.tournamentRefereeInvitation.findFirst.mockResolvedValue(null);
      prisma.tournamentRefereeInvitation.upsert.mockResolvedValue({ id: 1 });

      const res = await service.inviteReferee(1, 'newref@mail.com');
      expect(res.success).toBe(true);
      expect(res.email).toBe('newref@mail.com');
    });

    it('throws BadRequestException if invitation sent within 5 minutes', async () => {
      userClient.searchUsers.mockResolvedValue({ data: [] });
      prisma.tournamentRefereeInvitation.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 2 * 60 * 1000), // 2 mins ago
      });

      await expect(service.inviteReferee(1, 'newref@mail.com')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('sends in-app notification if user exists', async () => {
      const mockUser = { id: 'user123', email: 'existing@mail.com', name: 'Existing Ref' };
      userClient.searchUsers.mockResolvedValue({ data: [mockUser] });
      prisma.tournamentRefereeInvitation.findFirst.mockResolvedValue(null);
      prisma.tournamentRefereeInvitation.upsert.mockResolvedValue({ id: 1 });

      const res = await service.inviteReferee(1, 'existing@mail.com');
      expect(res.success).toBe(true);
      expect(notificationClient.sendInAppNotification).toHaveBeenCalledWith(
        ['user123'],
        'Lời mời làm trọng tài',
        expect.any(String),
      );
    });

    it('throws InternalServerErrorException and deletes invitation if email sending fails for non-existent user', async () => {
      userClient.searchUsers.mockResolvedValue({ data: [] });
      prisma.tournamentRefereeInvitation.findFirst.mockResolvedValue(null);
      prisma.tournamentRefereeInvitation.upsert.mockResolvedValue({ id: 1 });
      prisma.tournamentRefereeInvitation.delete.mockResolvedValue({});
      notificationClient.sendEmail.mockResolvedValue(false);

      await expect(service.inviteReferee(1, 'newref@mail.com')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(prisma.tournamentRefereeInvitation.delete).toHaveBeenCalledWith({
        where: {
          tournamentId_email: {
            tournamentId: 1,
            email: 'newref@mail.com',
          },
        },
      });
    });

    it('throws InternalServerErrorException even if user exists but email sending fails', async () => {
      const mockUser = { id: 'user123', email: 'existing@mail.com', name: 'Existing Ref' };
      userClient.searchUsers.mockResolvedValue({ data: [mockUser] });
      prisma.tournamentRefereeInvitation.findFirst.mockResolvedValue(null);
      prisma.tournamentRefereeInvitation.upsert.mockResolvedValue({ id: 1 });
      prisma.tournamentRefereeInvitation.delete.mockResolvedValue({});
      notificationClient.sendEmail.mockResolvedValue(false);

      await expect(service.inviteReferee(1, 'existing@mail.com')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getInvitationByTokenInternal', () => {
    it('returns invitation metadata', async () => {
      prisma.tournamentRefereeInvitation.findUnique.mockResolvedValue({
        id: 100,
        tournamentId: 1,
        email: 'ref@mail.com',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
        tournament: { name: 'Test Tournament' },
      });

      const res = await service.getInvitationByTokenInternal('token123');
      expect(res.id).toBe(100);
      expect(res.email).toBe('ref@mail.com');
      expect(res.tournament.name).toBe('Test Tournament');
    });

    it('throws NotFoundException if invitation not found', async () => {
      prisma.tournamentRefereeInvitation.findUnique.mockResolvedValue(null);
      await expect(service.getInvitationByTokenInternal('token123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('acceptInvitationInternal', () => {
    it('accepts invitation and registers referee using user profile', async () => {
      prisma.tournamentRefereeInvitation.findUnique.mockResolvedValue({
        id: 100,
        tournamentId: 1,
        email: 'ref@mail.com',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
      });
      userClient.getUserProfile.mockResolvedValue({
        fullName: 'Ref User',
        email: 'ref@mail.com',
      });
      prisma.tournamentReferee.findUnique.mockResolvedValue(null);

      const res = await service.acceptInvitationInternal('token123', 'user123');
      expect(res.success).toBe(true);
      expect(prisma.tournamentReferee.create).toBeDefined();
    });

    it('accepts invitation and registers referee with fallback details when profile not found', async () => {
      prisma.tournamentRefereeInvitation.findUnique.mockResolvedValue({
        id: 100,
        tournamentId: 1,
        email: 'ref@mail.com',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
      });
      userClient.getUserProfile.mockResolvedValue(null);
      prisma.tournamentReferee.findUnique.mockResolvedValue(null);

      const res = await service.acceptInvitationInternal('token123', 'user123');
      expect(res.success).toBe(true);
      expect(prisma.tournamentReferee.create).toBeDefined();
    });
  });
});
