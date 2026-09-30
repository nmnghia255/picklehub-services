import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { SportCenterClient } from '../clients/sport-center.client';
import { MatchViewService } from '../common/match-view.service';
import { NotificationClient } from '../clients/notification.client';
import { MatchClient } from '../clients/match.client';

const CID = '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a';
const EXT = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
const ITEM = 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f';

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: any;
  let sc: any;
  let matchView: any;

  beforeEach(async () => {
    prisma = {
      tournament: { findUnique: jest.fn().mockResolvedValue({ id: 1, centerIds: [CID] }) },
      tournamentEvent: {
        findFirst: jest.fn().mockResolvedValue({ id: 10, tournamentId: 1, name: 'Mixed', bracketStatus: 'locked' }),
        findUnique: jest.fn().mockResolvedValue({ id: 10, tournamentId: 1, name: 'Mixed', bracketStatus: 'locked' }),
      },
      tournamentBooking: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      match: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
      team: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (cb: any) => {
        if (typeof cb === 'function') return cb(prisma);
        return Promise.all(cb);
      }),
    };
    sc = {
      createBooking: jest.fn(),
      cancelBooking: jest.fn(),
      getBookingsByIds: jest.fn().mockResolvedValue(new Map()),
    };
    matchView = { enrich: jest.fn(async (_t: number, rows: any[]) => rows.map((r) => ({ id: r.id, enriched: true }))) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SportCenterClient, useValue: sc },
        { provide: MatchViewService, useValue: matchView },
        {
          provide: MatchClient,
          useValue: {
            unsyncSchedule: jest.fn(async () => true),
            updateMatch: jest.fn(async () => true),
          },
        },
        {
          provide: NotificationClient,
          useValue: {
            getUserEmail: jest.fn(async (id) => `mock-${id}@example.com`),
            sendEmail: jest.fn(async () => true),
          },
        },
      ],
    }).compile();
    service = module.get(BookingsService);
  });

  describe('createBooking', () => {
    const dto = {
      centerId: CID,
      bookings: [
        {
          date: '2026-06-20',
          items: [{ courtId: 'x', startTime: '17:00', endTime: '18:00' }],
        },
      ],
      playerName: 'Tournament Organizer',
      phoneNumber: '1234567890',
    };

    it('rejects a center that is not selected', async () => {
      prisma.tournament.findUnique.mockResolvedValue({ id: 1, centerIds: [] });
      await expect(service.createBooking(1, dto as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates the booking and persists a PENDING mirror', async () => {
      sc.createBooking.mockResolvedValue([{ id: EXT, date: '2026-06-20', status: 'PENDING', totalPrice: 200 }]);
      prisma.tournamentBooking.create.mockResolvedValue({ id: 5, externalBookingId: EXT });

      const res = await service.createBooking(1, dto as any, 'Bearer x');

      expect(res).toHaveLength(1);
      expect(prisma.tournamentBooking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ externalBookingId: EXT, centerId: CID, statusMirror: 'PENDING', totalPrice: 200 }),
      });
    });

    it('rejects when sport-center cannot create the booking', async () => {
      sc.createBooking.mockResolvedValue([]);
      await expect(service.createBooking(1, dto as any)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.tournamentBooking.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelBooking', () => {
    it('cancels, unlinks fixtures and marks the mirror CANCELLED', async () => {
      prisma.tournamentBooking.findFirst.mockResolvedValue({ id: 5, tournamentId: 1, externalBookingId: EXT });
      sc.cancelBooking.mockResolvedValue({ status: 'CANCELLED' });

      await service.cancelBooking(1, 5, 'Bearer x');

      expect(prisma.match.updateMany).toHaveBeenCalledWith({
        where: { tournamentId: 1, bookingId: 5 },
        data: { bookingId: null, bookingItemId: null },
      });
      expect(prisma.tournamentBooking.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { statusMirror: 'CANCELLED' },
      });
    });

    it('rejects when sport-center cancel fails and the booking is not already cancelled', async () => {
      prisma.tournamentBooking.findFirst.mockResolvedValue({ id: 5, tournamentId: 1, externalBookingId: EXT });
      sc.cancelBooking.mockResolvedValue(null);
      sc.getBookingsByIds.mockResolvedValue(new Map([[EXT, { status: 'COMPLETED' }]]));
      await expect(service.cancelBooking(1, 5)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('treats an already-cancelled (expired) booking as an idempotent success', async () => {
      prisma.tournamentBooking.findFirst.mockResolvedValue({ id: 5, tournamentId: 1, externalBookingId: EXT });
      sc.cancelBooking.mockResolvedValue(null);
      sc.getBookingsByIds.mockResolvedValue(new Map([[EXT, { status: 'CANCELLED' }]]));
      await service.cancelBooking(1, 5);
      expect(prisma.tournamentBooking.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { statusMirror: 'CANCELLED' },
      });
    });

    it('throws NotFound for an unknown booking', async () => {
      prisma.tournamentBooking.findFirst.mockResolvedValue(null);
      await expect(service.cancelBooking(1, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('scheduleFixture', () => {
    it('links a fixture to a valid booking item and returns it enriched', async () => {
      prisma.match.findFirst.mockResolvedValueOnce({ id: 10 }); // getFixture
      // enrichFixture (oldFixture): findMany call 1
      prisma.match.findMany.mockResolvedValueOnce([{ id: 10 }]);
      prisma.tournamentBooking.findFirst.mockResolvedValue({ id: 5, tournamentId: 1, externalBookingId: EXT, statusMirror: 'CONFIRMED', date: '2026-06-25' });
      // booking item includes court info
      sc.getBookingsByIds.mockResolvedValue(new Map([[EXT, { status: 'CONFIRMED', bookingItems: [{ id: ITEM, startTime: '08:00', endTime: '09:00', courtId: 'court-a', courtName: 'Court A' }] }]]));
      // allMirrors for clash detection
      prisma.tournamentBooking.findMany.mockResolvedValueOnce([{ id: 5, externalBookingId: EXT, date: '2026-06-25' }]);
      // allDbMatches clash check (findMany call 2): no clashes
      prisma.match.findMany.mockResolvedValueOnce([]);
      // enrichFixture (newFixture): findMany call 3
      prisma.match.findMany.mockResolvedValueOnce([{ id: 10 }]);
      // detectPlayerWarnings (findMany call 4): no other scheduled matches
      prisma.match.findMany.mockResolvedValueOnce([]);

      const res = await service.scheduleFixture(1, 10, { bookingId: 5, bookingItemId: ITEM, matchDurationMinutes: 45 });

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { bookingId: 5, bookingItemId: ITEM, duration: 45, time: expect.any(Date) },
      });
      expect(res).toMatchObject({ id: 10, enriched: true, warnings: expect.any(Array) });
    });

    it('rejects an item that does not belong to the booking', async () => {
      prisma.match.findFirst.mockResolvedValueOnce({ id: 10 });
      prisma.tournamentBooking.findFirst.mockResolvedValue({ id: 5, tournamentId: 1, externalBookingId: EXT, statusMirror: 'CONFIRMED' });
      sc.getBookingsByIds.mockResolvedValue(new Map([[EXT, { status: 'CONFIRMED', bookingItems: [{ id: 'other', startTime: '08:00', endTime: '09:00' }] }]]));
      await expect(service.scheduleFixture(1, 10, { bookingId: 5, bookingItemId: ITEM, matchDurationMinutes: 45 })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a slot already assigned to another fixture', async () => {
      prisma.match.findFirst.mockResolvedValueOnce({ id: 10 }); // getFixture
      // enrichFixture (oldFixture) → returns empty (will be null due to catch)
      prisma.match.findMany.mockResolvedValueOnce([{ id: 10 }]);
      prisma.tournamentBooking.findFirst.mockResolvedValue({ id: 5, tournamentId: 1, externalBookingId: EXT, statusMirror: 'CONFIRMED', date: '2026-06-25' });
      // getBookingsByIds is called for the target booking AND for allLive (allMirrors)
      sc.getBookingsByIds.mockResolvedValue(new Map([[EXT, { status: 'CONFIRMED', bookingItems: [{ id: ITEM, startTime: '08:00', endTime: '09:00', courtId: 'court-a', courtName: 'Court A' }] }]]));
      // allMirrors returns the same booking
      prisma.tournamentBooking.findMany.mockResolvedValueOnce([{ id: 5, externalBookingId: EXT, date: '2026-06-25' }]);
      // allDbMatches clash check: existing match 99 has bookingItemId=ITEM, same court 'court-a', same date 2026-06-25
      // matchStartMins=480(08:00), dbmStart=480(08:00), dbmDuration=45, dbmEnd=525 → overlap → clash!
      prisma.match.findMany.mockResolvedValueOnce([{ id: 99, bookingItemId: ITEM, time: new Date('2026-06-25T08:00:00.000Z'), duration: 45 }]);

      await expect(service.scheduleFixture(1, 10, { bookingId: 5, bookingItemId: ITEM, matchDurationMinutes: 45 })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects scheduling a bracket match if the bracket is not locked', async () => {
      prisma.match.findFirst.mockResolvedValueOnce({ id: 10, eventId: 10, groupStage: false });
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce({ id: 10, bracketStatus: 'unlocked' });
      await expect(service.scheduleFixture(1, 10, { bookingId: 5, bookingItemId: ITEM, matchDurationMinutes: 45 })).rejects.toThrow(
        new BadRequestException('Nhánh đấu (Bracket) phải được khóa trước khi xếp lịch thi đấu.')
      );
    });

    it('allows scheduling a group stage match even if the bracket is unlocked', async () => {
      prisma.match.findFirst.mockResolvedValueOnce({ id: 10, eventId: 10, groupStage: true });
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce({ id: 10, bracketStatus: 'unlocked' });
      prisma.tournamentBooking.findFirst.mockResolvedValue({ id: 5, tournamentId: 1, externalBookingId: EXT, statusMirror: 'CONFIRMED' });
      sc.getBookingsByIds.mockResolvedValue(new Map([[EXT, { status: 'CONFIRMED', bookingItems: [{ id: ITEM, startTime: '08:00', endTime: '09:00' }] }]]));
      prisma.match.findMany.mockResolvedValueOnce([]); // no clash
      prisma.match.update.mockResolvedValueOnce({ id: 10 });
      prisma.match.findMany.mockResolvedValueOnce([{ id: 10 }]); // for enrichment
      const res = await service.scheduleFixture(1, 10, { bookingId: 5, bookingItemId: ITEM, matchDurationMinutes: 45 });
      expect(res).toBeDefined();
    });
  });

  describe('unlinkFixture', () => {
    it('clears the booking link and returns the fixture enriched', async () => {
      prisma.match.findFirst.mockResolvedValue({ id: 10 });
      prisma.match.findMany.mockResolvedValue([{ id: 10 }]);
      const res = await service.unlinkFixture(1, 10);
      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { bookingId: null, bookingItemId: null },
      });
      expect(res).toEqual({ id: 10, enriched: true });
    });
  });

  describe('getSchedule', () => {
    it('counts only real, unbooked fixtures as remaining', async () => {
      prisma.match.findMany.mockResolvedValue([
        { id: 1, team1Id: 1, team2Id: 2, status: 'scheduled', bookingId: null }, // needs court
        { id: 2, team1Id: 1, team2Id: 2, status: 'scheduled', bookingId: 5 }, // booked
        { id: 3, team1Id: 1, team2Id: null, status: 'walkover', bookingId: null }, // bye
        { id: 4, team1Id: 1, team2Id: 2, status: 'completed', bookingId: null }, // done
      ]);
      const res = await service.getSchedule(1);
      expect(res.meta.bookingsRemaining).toBe(1);
      expect(res.meta.total).toBe(4);
    });

    it('returns the fixtures enriched to the FE Match shape', async () => {
      const rows = [{ id: 1, team1Id: 1, team2Id: 2, status: 'scheduled', bookingId: 5 }];
      prisma.match.findMany.mockResolvedValue(rows);

      const res = await service.getSchedule(1);

      expect(matchView.enrich).toHaveBeenCalledWith(1, rows);
      expect(res.data).toEqual([{ id: 1, enriched: true }]);
    });

    it('applies query filters (eventId, courtId, date, status) to findMany', async () => {
      prisma.match.findMany.mockResolvedValue([]);
      
      const dateStr = '2026-06-30';
      const start = new Date(dateStr);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(dateStr);
      end.setUTCHours(23, 59, 59, 999);

      await service.getSchedule(1, 10, 5, dateStr, 'scheduled');

      expect(prisma.match.findMany).toHaveBeenCalledWith({
        where: {
          tournamentId: 1,
          eventId: 10,
          courtId: 5,
          status: 'scheduled',
          time: {
            gte: start,
            lte: end,
          },
        },
        orderBy: { id: 'asc' },
        include: { team1: true, team2: true, event: { select: { name: true } } },
      });
    });

    it('applies query filters (scheduled = true/false) to findMany', async () => {
      prisma.match.findMany.mockResolvedValue([]);

      await service.getSchedule(1, 10, undefined, undefined, undefined, true);
      expect(prisma.match.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          bookingItemId: { not: null },
        }),
      }));

      await service.getSchedule(1, 10, undefined, undefined, undefined, false);
      expect(prisma.match.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          bookingItemId: null,
        }),
      }));
    });
  });

  describe('syncBookings', () => {
    it('updates a mirror whose live status changed', async () => {
      prisma.tournamentBooking.findMany.mockResolvedValue([{ id: 5, externalBookingId: EXT, statusMirror: 'PENDING' }]);
      sc.getBookingsByIds.mockResolvedValue(new Map([[EXT, { status: 'CONFIRMED', bookingItems: [] }]]));

      await service.syncBookings(1);

      expect(prisma.tournamentBooking.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { statusMirror: 'CONFIRMED' },
      });
    });
  });

  describe('autoSchedule', () => {
    const configDto = {
      startTime: '08:00',
      endTime: '18:00',
      matchDurationMinutes: 45,
      restDurationMinutes: 15,
      optimizationCriteria: 'fastest' as any,
    };

    /** Helper to build a synced booking item in the shape returned by syncBookings */
    const makeSyncedBooking = (id: number, extId: string, items: any[]) => ({
      id,
      externalBookingId: extId,
      centerId: CID,
      date: '2026-06-25',
      statusMirror: 'CONFIRMED',
      liveStatus: 'CONFIRMED',
      totalPrice: 100,
      items,
      fixtures: [],
    });

    let syncSpy: jest.SpyInstance;

    beforeEach(() => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 10, tournamentId: 1, name: 'Mixed', bracketStatus: 'locked' });
      // Default: empty synced result (overridden per test)
      syncSpy = jest.spyOn(service as any, 'syncBookings').mockResolvedValue({ data: [], meta: { total: 0 } });
    });

    afterEach(() => {
      syncSpy.mockRestore();
    });

    it('previews auto-scheduling without writing to db', async () => {
      prisma.match.findMany.mockResolvedValueOnce([
        { id: 101, team1Id: 1, team2Id: 2, bookingItemId: null, round: 'Round 1', team1: { player1Id: 'p1' }, team2: { player1Id: 'p2' } },
      ]);
      syncSpy.mockResolvedValue({
        data: [makeSyncedBooking(501, 'ext-501', [
          { id: 'slot-1', courtName: 'Court A', startTime: '08:00', endTime: '09:00' },
          { id: 'slot-2', courtName: 'Court B', startTime: '09:00', endTime: '10:00' },
        ])],
        meta: { total: 1 },
      });
      // DB scheduled matches (empty)
      prisma.match.findMany.mockResolvedValueOnce([]);

      const result = await service.autoScheduleFixturesPreview(1, 10, configDto);

      expect(result.scheduledMatchesCount).toBe(1); // Only match 101 is playable
      expect(result.totalCourtsUsed).toBe(1);
      // Slot 08:00-09:00 subdivided → match slot 08:00-08:45, expectedCompletionTime is endTime of match
      expect(result.expectedCompletionTime).toBe('08:45');
      expect(result.previewAssignments[0].matchId).toBe(101);
      expect(prisma.match.update).not.toHaveBeenCalled();
    });


    it('schedules consecutive matches for a player but returns warnings', async () => {
      prisma.match.findMany.mockResolvedValueOnce([
        { id: 101, team1Id: 1, team2Id: 2, bookingItemId: null, round: 'Round 1', team1: { player1Id: 'p1', player1Name: 'Player 1' }, team2: { player1Id: 'p2' } },
        { id: 102, team1Id: 1, team2Id: 3, bookingItemId: null, round: 'Round 2', team1: { player1Id: 'p1', player1Name: 'Player 1' }, team2: { player1Id: 'p3' } },
      ]);
      syncSpy.mockResolvedValue({
        data: [makeSyncedBooking(501, 'ext-501', [
          { id: 'slot-1', courtName: 'Court A', startTime: '08:00', endTime: '09:00', courtId: 'court-a' },
          // Second slot starts at 08:45 = when first match ends → zero rest gap → warning
          { id: 'slot-2', courtName: 'Court B', startTime: '08:45', endTime: '09:45', courtId: 'court-b' },
        ])],
        meta: { total: 1 },
      });
      // No clashes in DB
      prisma.match.findMany.mockResolvedValueOnce([]);

      const result = await service.autoScheduleFixturesPreview(1, 10, configDto);

      expect(result.scheduledMatchesCount).toBe(2);
      expect(result.previewAssignments[0].bookingItemId).toBe('slot-1');
      expect(result.previewAssignments[1].bookingItemId).toBe('slot-2');
      // Expect at least one warning about short rest
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings[0]).toContain('WARNING');
      // Warning message uses player1Name from team data
      expect(result.warnings[0]).toContain('Player 1');
    });

    it('throws BadRequestException if no playable matches are found (bracket not generated)', async () => {
      prisma.match.findMany.mockResolvedValueOnce([]); // no playable matches
      prisma.match.count.mockResolvedValueOnce(0); // totalMatches = 0
      await expect(service.autoScheduleFixturesPreview(1, 10, configDto)).rejects.toThrow(
        new BadRequestException('Chưa tạo trận đấu vòng bảng cho sự kiện này. Vui lòng tạo vòng bảng trước.')
      );
    });

    it('throws BadRequestException if matches exist but no bookings found', async () => {
      prisma.match.findMany.mockResolvedValueOnce([
        { id: 101, team1Id: 1, team2Id: 2, bookingItemId: null, round: 'Round 1', team1: { player1Id: 'p1' }, team2: { player1Id: 'p2' } },
      ]);
      syncSpy.mockResolvedValue({ data: [], meta: { total: 0 } });
      await expect(service.autoScheduleFixturesPreview(1, 10, configDto)).rejects.toThrow(
        new BadRequestException('Giải đấu chưa có bất kỳ lượt đặt sân (Booking) nào. Vui lòng đặt sân trước.')
      );
    });

    it('throws BadRequestException if no booking slots match the time window', async () => {
      prisma.match.findMany.mockResolvedValueOnce([
        { id: 101, team1Id: 1, team2Id: 2, bookingItemId: null, round: 'Round 1', team1: { player1Id: 'p1' }, team2: { player1Id: 'p2' } },
      ]);
      syncSpy.mockResolvedValue({
        data: [makeSyncedBooking(501, 'ext-501', [
          { id: 'slot-1', courtName: 'Court A', startTime: '22:00', endTime: '23:00' }, // outside [08:00, 18:00]
        ])],
        meta: { total: 1 },
      });
      prisma.match.findMany.mockResolvedValueOnce([]);
      await expect(service.autoScheduleFixturesPreview(1, 10, configDto)).rejects.toThrow(
        /Không tìm thấy slot sân nào khả dụng/
      );
    });

    it('throws BadRequestException if the bracket is not locked when scheduling knockout matches', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce({ id: 10, tournamentId: 1, name: 'Mixed', bracketStatus: 'unlocked' });
      prisma.match.findMany.mockResolvedValueOnce([
        { id: 101, team1Id: 1, team2Id: 2, bookingItemId: null, round: 'Round 1', team1: { player1Id: 'p1' }, team2: { player1Id: 'p2' }, groupStage: false },
      ]);
      await expect(service.autoScheduleFixturesPreview(1, 10, configDto)).rejects.toThrow(
        new BadRequestException('Nhánh đấu (Bracket) phải được khóa trước khi xếp lịch thi đấu.')
      );
    });

    it('allows auto-scheduling if only group stage matches are present and the bracket is unlocked', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce({ id: 10, tournamentId: 1, name: 'Mixed', bracketStatus: 'unlocked' });
      prisma.match.findMany.mockResolvedValueOnce([
        { id: 101, team1Id: 1, team2Id: 2, bookingItemId: null, round: 'Round 1', team1: { player1Id: 'p1' }, team2: { player1Id: 'p2' }, groupStage: true },
      ]);
      syncSpy.mockResolvedValue({
        data: [makeSyncedBooking(501, 'ext-501', [
          { id: 'slot-1', courtName: 'Court A', startTime: '08:00', endTime: '09:00' },
        ])],
        meta: { total: 1 },
      });
      prisma.match.findMany.mockResolvedValueOnce([]); // mock clashes
      const res = await service.autoScheduleFixturesPreview(1, 10, configDto);
      expect(res.previewAssignments).toBeDefined();
    });

    it('throws BadRequestException if available slots are fewer than unscheduled matches', async () => {
      // 2 unscheduled matches but only 1 slot available
      prisma.match.findMany.mockResolvedValueOnce([
        { id: 101, team1Id: 1, team2Id: 2, bookingItemId: null, round: 'Round 1', team1: { player1Id: 'p1' }, team2: { player1Id: 'p2' } },
        { id: 102, team1Id: 3, team2Id: 4, bookingItemId: null, round: 'Round 1', team1: { player1Id: 'p3' }, team2: { player1Id: 'p4' } },
      ]);
      syncSpy.mockResolvedValue({
        data: [makeSyncedBooking(501, 'ext-501', [
          { id: 'slot-1', courtName: 'Court A', startTime: '08:00', endTime: '09:00' },
          // Only 1 slot, but 2 matches need scheduling
        ])],
        meta: { total: 1 },
      });
      prisma.match.findMany.mockResolvedValueOnce([]); // no already-scheduled conflicts

      await expect(service.autoScheduleFixturesPreview(1, 10, configDto)).rejects.toThrow(
        /Không đủ slot đặt sân/,
      );
    });

    it('filters out slots that do not meet the matchDurationMinutes threshold', async () => {
      prisma.match.findMany.mockResolvedValueOnce([
        { id: 101, team1Id: 1, team2Id: 2, bookingItemId: null, round: 'Round 1', team1: { player1Id: 'p1' }, team2: { player1Id: 'p2' } },
      ]);
      syncSpy.mockResolvedValue({
        data: [makeSyncedBooking(501, 'ext-501', [
          // slot-too-short: 30 min block, matchDuration=45 → loop condition: 0+45 <= 30 is false → skipped
          { id: 'slot-too-short', courtName: 'Court A', startTime: '08:00', endTime: '08:30', courtId: 'court-a' }, 
          // slot-ok: 60 min block, matchDuration=45 → loop condition: 0+45 <= 60 is true → included
          { id: 'slot-ok', courtName: 'Court B', startTime: '09:00', endTime: '10:00', courtId: 'court-b' },
        ])],
        meta: { total: 1 },
      });
      prisma.match.findMany.mockResolvedValueOnce([]);

      const result = await service.autoScheduleFixturesPreview(1, 10, configDto);
      expect(result.scheduledMatchesCount).toBe(1);
      expect(result.previewAssignments[0].bookingItemId).toBe('slot-ok');
    });

    it('works when restDurationMinutes is not provided', async () => {
      const minimalConfig = {
        startTime: '08:00',
        endTime: '18:00',
        matchDurationMinutes: 45,
        optimizationCriteria: 'fastest' as any,
      };
      prisma.match.findMany.mockResolvedValueOnce([
        { id: 101, team1Id: 1, team2Id: 2, bookingItemId: null, round: 'Round 1', team1: { player1Id: 'p1' }, team2: { player1Id: 'p2' } },
      ]);
      syncSpy.mockResolvedValue({
        data: [makeSyncedBooking(501, 'ext-501', [
          { id: 'slot-1', courtName: 'Court A', startTime: '08:00', endTime: '08:45' }, // 45 mins -> ok since rest defaults to 0
        ])],
        meta: { total: 1 },
      });
      prisma.match.findMany.mockResolvedValueOnce([]);

      const result = await service.autoScheduleFixturesPreview(1, 10, minimalConfig as any);
      expect(result.scheduledMatchesCount).toBe(1);
      expect(result.previewAssignments[0].bookingItemId).toBe('slot-1');
    });

    it('generates warnings if a player has consecutive matches with less than 15 minutes break', async () => {
      const configWithNoBreakConstraint = {
        startTime: '08:00',
        endTime: '18:00',
        matchDurationMinutes: 30,
        restDurationMinutes: 0,
        optimizationCriteria: 'fastest' as any,
      };

      // player p1 (player1Name: 'Alice') plays in both match 101 and 102
      prisma.match.findMany.mockResolvedValueOnce([
        { id: 101, team1Id: 1, team2Id: 2, bookingItemId: null, round: 'Round 1', team1: { player1Id: 'p1', player1Name: 'Alice' }, team2: { player1Id: 'p2' } },
        { id: 102, team1Id: 1, team2Id: 3, bookingItemId: null, round: 'Round 2', team1: { player1Id: 'p1', player1Name: 'Alice' }, team2: { player1Id: 'p3' } },
      ]);
      syncSpy.mockResolvedValue({
        data: [makeSyncedBooking(501, 'ext-501', [
          // match 30min, rest=0 → slot-1: 08:00-08:30, slot-2 starts at 08:30 → gap=0 < 15 → warning
          { id: 'slot-1', courtName: 'Court A', startTime: '08:00', endTime: '08:30', courtId: 'court-a' },
          { id: 'slot-2', courtName: 'Court B', startTime: '08:30', endTime: '09:00', courtId: 'court-b' },
        ])],
        meta: { total: 1 },
      });
      prisma.match.findMany.mockResolvedValueOnce([]);

      const result = await service.autoScheduleFixturesPreview(1, 10, configWithNoBreakConstraint);
      expect(result.scheduledMatchesCount).toBe(2);
      expect(result.warnings).toBeDefined();
      // Alice plays back-to-back with 0 min gap < 15 min threshold → WARNING should fire
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings[0]).toContain('WARNING');
      expect(result.warnings[0]).toContain('Alice');
    });
  });




  describe('createBooking (multi-day payload)', () => {
    const multiDto = {
      centerId: CID,
      bookings: [
        {
          date: '2026-07-20',
          items: [{ courtId: 'x', startTime: '08:00', endTime: '09:00' }],
        },
      ],
      playerName: 'Org',
      phoneNumber: '123',
    };

    it('creates multiple local mirrors from sport-center response', async () => {
      sc.createBooking = jest.fn().mockResolvedValue([
        { id: EXT, date: '2026-07-20T00:00:00.000Z', status: 'PENDING', totalPrice: 100 },
      ]);
      prisma.tournamentBooking.create.mockResolvedValue({ id: 9, externalBookingId: EXT });

      const res = await service.createBooking(1, multiDto as any, 'Bearer token');
      expect(res).toHaveLength(1);
      expect(prisma.tournamentBooking.create).toHaveBeenCalled();
    });
  });

  describe('scheduleFixture validations', () => {
    it('throws BadRequestException if the booking status is not CONFIRMED', async () => {
      const mockFixture = { id: 101, eventId: 10, duration: 60 };
      prisma.match.findFirst = jest.fn().mockResolvedValue(mockFixture);
      prisma.tournamentBooking.findFirst = jest.fn().mockResolvedValue({ id: 5, externalBookingId: EXT, statusMirror: 'PENDING' });
      sc.getBookingsByIds.mockResolvedValueOnce(new Map([[EXT, { status: 'PENDING', bookingItems: [{ id: ITEM, startTime: '08:00', endTime: '09:00' }] }]]));

      await expect(service.scheduleFixture(1, 101, { bookingId: 5, bookingItemId: ITEM, matchDurationMinutes: 60 })).rejects.toThrow(
        new BadRequestException('Trận đấu chỉ có thể được xếp lịch vào lượt đặt sân đã được xác nhận (CONFIRMED).')
      );
    });

    it('assigns a slot to a fixture even if matchDuration > slot block size (time-based, no duration guard)', async () => {
      // New scheduleFixture implementation uses match start time directly from item.startTime
      // It no longer enforces duration >= slot block size, so this succeeds
      const mockFixture = { id: 101, eventId: 10, duration: 90 };
      prisma.match.findFirst = jest.fn().mockResolvedValueOnce(mockFixture).mockResolvedValueOnce(null);
      prisma.tournamentBooking.findFirst = jest.fn().mockResolvedValue({ id: 5, externalBookingId: EXT, statusMirror: 'CONFIRMED', date: '2026-07-25' });
      sc.getBookingsByIds.mockResolvedValue(new Map([[EXT, { status: 'CONFIRMED', bookingItems: [{ id: ITEM, startTime: '08:00', endTime: '09:00', courtId: 'court-a' }] }]]));
      prisma.tournamentBooking.findMany.mockResolvedValue([{ id: 5, externalBookingId: EXT, date: '2026-07-25' }]);
      prisma.match.findMany
        .mockResolvedValueOnce([]) // clash check for all db matches
        .mockResolvedValueOnce([{ id: 101 }]); // for enrichment / warning detection
      prisma.match.update.mockResolvedValueOnce({ id: 101, time: new Date('2026-07-25T08:00:00.000Z'), duration: 90 });

      const res = await service.scheduleFixture(1, 101, { bookingId: 5, bookingItemId: ITEM, matchDurationMinutes: 90 });
      expect(res).toBeDefined();
    });

    it('updates match duration in the database if matchDurationMinutes is provided', async () => {
      const mockFixture = { id: 101, eventId: 10, duration: 60 };
      prisma.match.findFirst = jest.fn().mockResolvedValueOnce(mockFixture).mockResolvedValueOnce(null);
      prisma.tournamentBooking.findFirst = jest.fn().mockResolvedValue({ id: 5, externalBookingId: EXT, statusMirror: 'CONFIRMED', date: '2026-07-25' });
      sc.getBookingsByIds.mockResolvedValue(new Map([[EXT, { status: 'CONFIRMED', bookingItems: [{ id: ITEM, startTime: '08:00', endTime: '09:00', courtId: 'court-a' }] }]]));
      prisma.tournamentBooking.findMany.mockResolvedValue([{ id: 5, externalBookingId: EXT, date: '2026-07-25' }]);
      prisma.match.findMany
        .mockResolvedValueOnce([]) // clash DB check
        .mockResolvedValueOnce([{ id: 101 }]); // for warning detection
      prisma.match.update.mockResolvedValueOnce({ id: 101, time: new Date('2026-07-25T08:00:00.000Z'), duration: 30 });

      await service.scheduleFixture(1, 101, { bookingId: 5, bookingItemId: ITEM, matchDurationMinutes: 30 });

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: {
          bookingId: 5,
          bookingItemId: ITEM,
          duration: 30,
          time: expect.any(Date), // new field: match start time persisted
        },
      });
    });
  });

  describe('listBookingItems', () => {
    it('lists all slots merged with assigned matches', async () => {
      prisma.tournamentBooking.findMany.mockResolvedValueOnce([{ id: 5, externalBookingId: EXT, date: '2026-07-20' }]);
      sc.getBookingsByIds.mockResolvedValueOnce(new Map([[EXT, { status: 'CONFIRMED', bookingItems: [{ id: ITEM, startTime: '08:00', endTime: '09:00', courtId: 'c1', courtName: 'Court A' }] }]]));
      prisma.match.findMany.mockResolvedValueOnce([
        { id: 101, round: 'Round 1', eventId: 10, status: 'scheduled', bookingItemId: ITEM, event: { name: 'Men' }, team1: { name: 'A' }, team2: { name: 'B' } }
      ]);

      const res = await service.listBookingItems(1);
      expect(res).toHaveLength(1);
      expect(res[0].assignedMatch.id).toEqual(101);
    });
  });

  describe('getBookedSlots', () => {
    it('returns the booked slots filtered by centerId and date', async () => {
      prisma.tournamentBooking.findMany.mockResolvedValueOnce([{ id: 5, externalBookingId: EXT, date: '2026-07-20' }]);
      sc.getBookingsByIds.mockResolvedValueOnce(new Map([[EXT, { status: 'CONFIRMED', bookingItems: [{ id: ITEM, startTime: '08:00', endTime: '09:00', courtId: 'c1', courtName: 'Court A' }] }]]));
      prisma.match.findMany.mockResolvedValueOnce([
        { id: 101, round: 'Round 1', eventId: 10, status: 'scheduled', bookingItemId: ITEM, event: { name: 'Men' }, team1: { name: 'A' }, team2: { name: 'B' } }
      ]);

      const res = await service.getBookedSlots(1, 'center-1', '2026-07-20');
      expect(prisma.tournamentBooking.findMany).toHaveBeenCalledWith({
        where: {
          tournamentId: 1,
          centerId: 'center-1',
          date: '2026-07-20',
        },
      });
      expect(res).toHaveLength(1);
      expect(res[0].assignedMatch.id).toEqual(101);
    });
  });

  describe('confirmAutoScheduleFixtures', () => {
    const payload = {
      assignments: [
        {
          matchId: 101,
          bookingId: 5,
          bookingItemId: ITEM,
          matchDurationMinutes: 45,
        },
      ],
    };

    beforeEach(() => {
      prisma.tournamentEvent.findFirst.mockResolvedValue({ id: 10, tournamentId: 1, name: 'Mixed', bracketStatus: 'locked' });
      prisma.tournamentBooking.findMany.mockResolvedValue([{ id: 5, externalBookingId: EXT, statusMirror: 'CONFIRMED', date: '2026-07-25' }]);
      sc.getBookingsByIds.mockResolvedValue(new Map([[EXT, { status: 'CONFIRMED', bookingItems: [{ id: ITEM, startTime: '08:00', endTime: '09:00' }] }]]));
    });

    it('commits customized schedule assignments in transaction', async () => {
      const mockTime = new Date('2026-07-25T08:00:00.000Z');
      prisma.match.findUnique.mockResolvedValueOnce({ id: 101, eventId: 10, groupStage: true, team1: { player1Id: 'p1' }, team2: { player1Id: 'p2' } });
      prisma.match.findFirst.mockResolvedValueOnce(null); // clash check
      prisma.match.update.mockResolvedValueOnce({ id: 101, team1Id: 1, team2Id: 2, bookingId: 5, bookingItemId: ITEM, duration: 45, time: mockTime });
      prisma.match.findMany.mockResolvedValueOnce([{ id: 101 }]); // for enrichment + warning detection

      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

      const res = await service.confirmAutoScheduleFixtures(1, 10, payload as any);

      expect(res.success).toBe(true);
      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 101 },
        data: { bookingId: 5, bookingItemId: ITEM, duration: 45, time: expect.any(Date) },
        include: { team1: true, team2: true, event: { select: { name: true } } },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('throws BadRequestException if the event does not exist', async () => {
      prisma.tournamentEvent.findFirst.mockResolvedValueOnce(null);
      await expect(service.confirmAutoScheduleFixtures(1, 10, payload as any)).rejects.toThrow(
        new NotFoundException('Event with ID 10 not found in tournament 1')
      );
    });

    it('throws BadRequestException if there is a slot duration mismatch', async () => {
      prisma.match.findUnique.mockResolvedValueOnce({ id: 101, eventId: 10, groupStage: true, team1: { player1Id: 'p1' }, team2: { player1Id: 'p2' } });
      const badPayload = {
        assignments: [
          {
            matchId: 101,
            bookingId: 5,
            bookingItemId: ITEM,
            matchDurationMinutes: 90, // Slot is only 60 mins (08:00 - 09:00)
          },
        ],
      };
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

      await expect(service.confirmAutoScheduleFixtures(1, 10, badPayload as any)).rejects.toThrow(
        /không đủ cho thời lượng trận đấu/
      );
    });
  });
});

