import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CourtsService } from './courts.service';
import { PrismaService } from '../prisma/prisma.service';
import { SportCenterClient } from '../clients/sport-center.client';

const CID = '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a';
const CID2 = '11111111-1111-4111-8111-111111111111';

describe('CourtsService', () => {
  let service: CourtsService;
  let prisma: any;
  let sc: any;

  beforeEach(async () => {
    prisma = {
      tournament: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      tournamentBooking: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn() },
      match: { findMany: jest.fn() },
    };
    sc = {
      getCenter: jest.fn(),
      getCenterCourts: jest.fn().mockResolvedValue([]),
      getCourtAvailability: jest.fn(),
      getBookingsByIds: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourtsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SportCenterClient, useValue: sc },
      ],
    }).compile();
    service = module.get(CourtsService);
  });

  describe('listCenters', () => {
    it('enriches each selected center with detail and courts', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID] });
      sc.getCenter.mockResolvedValue({ name: 'C1', address: 'A', status: 'ACTIVE' });
      sc.getCenterCourts.mockResolvedValue([{ id: 'court1', name: 'San 1', type: 'INDOOR', status: 'ACTIVE' }]);

      const res = await service.listCenters(1, 'Bearer x');

      expect(res.meta).toEqual({ total: 1 });
      expect(res.data[0]).toMatchObject({ centerId: CID, name: 'C1', exists: true });
      expect(res.data[0].courts[0]).toMatchObject({ courtId: 'court1', name: 'San 1' });
    });

    it('marks a center that no longer resolves as exists:false', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID] });
      sc.getCenter.mockResolvedValue(null);

      const res = await service.listCenters(1);
      expect(res.data[0].exists).toBe(false);
      expect(res.data[0].name).toBeNull();
    });

    it('throws NotFound when the tournament is missing', async () => {
      prisma.tournament.findUnique.mockResolvedValue(null);
      await expect(service.listCenters(99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('addCenters', () => {
    it('adds validated centers (deduped) to the selection', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID] });
      sc.getCenter.mockResolvedValue({ name: 'C2' });

      await service.addCenters(1, [CID2, CID2], 'Bearer x');

      expect(prisma.tournament.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { centerIds: [CID, CID2] },
      });
    });

    it('rejects when a center does not exist', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [] });
      sc.getCenter.mockResolvedValue(null);

      await expect(service.addCenters(1, [CID2])).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.tournament.update).not.toHaveBeenCalled();
    });
  });

  describe('removeCenter', () => {
    it('removes a selected center', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID, CID2] });
      await service.removeCenter(1, CID);
      expect(prisma.tournament.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { centerIds: [CID2] },
      });
    });

    it('throws NotFound when removing a center that is not selected', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID] });
      await expect(service.removeCenter(1, CID2)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('blocks removal while the center has active bookings', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID, CID2] });
      prisma.tournamentBooking.count.mockResolvedValue(2);
      await expect(service.removeCenter(1, CID)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.tournament.update).not.toHaveBeenCalled();
    });
  });

  describe('getAvailability', () => {
    it('rejects a center that is not selected', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID] });
      await expect(service.getAvailability(1, CID2, '2026-06-20')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a missing date', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID] });
      await expect(service.getAvailability(1, CID, '')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns availability for a selected center, forwarding the auth header', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID] });
      sc.getCourtAvailability.mockResolvedValue({ date: '2026-06-20', courts: [] });

      const res = await service.getAvailability(1, CID, '2026-06-20', 'Bearer x');
      expect(res).toEqual({ date: '2026-06-20', courts: [] });
      expect(sc.getCourtAvailability).toHaveBeenCalledWith(CID, '2026-06-20', 'Bearer x');
    });

    it('throws NotFound when sport-center returns no availability', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID] });
      sc.getCourtAvailability.mockResolvedValue(null);
      await expect(service.getAvailability(1, CID, '2026-06-20')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getBookedSlots', () => {
    it('rejects a center that is not selected', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID] });
      await expect(service.getBookedSlots(1, CID2, '2026-06-20')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a missing date', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID] });
      await expect(service.getBookedSlots(1, CID, '')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns empty array when there are no mirrors', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID] });
      prisma.tournamentBooking.findMany.mockResolvedValue([]);
      const res = await service.getBookedSlots(1, CID, '2026-06-20');
      expect(res).toEqual([]);
    });

    it('returns the booked slots filtered by centerId and date', async () => {
      const EXT = 'ext-booking-uuid';
      const ITEM = 'item-uuid';
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [CID] });
      prisma.tournamentBooking.findMany.mockResolvedValue([{ id: 5, externalBookingId: EXT, date: '2026-06-20' }]);
      sc.getBookingsByIds.mockResolvedValue(new Map([[EXT, { status: 'CONFIRMED', bookingItems: [{ id: ITEM, startTime: '08:00', endTime: '09:00', courtId: 'c1', courtName: 'Court A' }] }]]));
      prisma.match.findMany.mockResolvedValue([
        { id: 101, round: 'Round 1', eventId: 10, status: 'scheduled', bookingItemId: ITEM, event: { name: 'Men' }, team1: { name: 'A' }, team2: { name: 'B' } }
      ]);

      const res = await service.getBookedSlots(1, CID, '2026-06-20');
      expect(prisma.tournamentBooking.findMany).toHaveBeenCalledWith({
        where: {
          tournamentId: 1,
          centerId: CID,
          date: '2026-06-20',
        },
      });
      expect(res).toHaveLength(1);
      expect(res[0].assignedMatch.id).toEqual(101);
    });
  });
});
