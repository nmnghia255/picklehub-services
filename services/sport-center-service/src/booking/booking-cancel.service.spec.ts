import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingCancelService } from './booking-cancel.service';
import { PrismaService } from '../prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreditService } from './credit.service';
import { PaymentTransactionService } from './payment-transaction.service';

describe('BookingCancelService', () => {
  let service: BookingCancelService;
  let prisma: any;
  let notification: { sendBookingCancelledNotification: jest.Mock };

  beforeEach(async () => {
    prisma = {
      booking: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      product: {
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };
    notification = { sendBookingCancelledNotification: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingCancelService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: notification },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(10) } },
        { provide: CreditService, useValue: {} },
        { provide: PaymentTransactionService, useValue: { voidPendingPayment: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(BookingCancelService);
  });

  describe('cancelFutureBookingsForCourt', () => {
    const buildTx = (
      findManyResult: any[],
    ): {
      booking: { findMany: jest.Mock; updateMany: jest.Mock };
      bookingItem: { findMany: jest.Mock };
    } => ({
      booking: {
        findMany: jest.fn().mockResolvedValue(findManyResult),
        updateMany: jest
          .fn()
          .mockResolvedValue({ count: findManyResult.length }),
      },
      bookingItem: {
        findMany: jest.fn().mockResolvedValue(
          findManyResult.map(booking => ({
            bookingId: booking.id,
            startTime: booking.startTime,
            endTime: booking.endTime,
            courtId: booking.courtId,
            court: {
              name: 'San 1',
              center: {
                name: 'PickleDome',
              },
            },
            booking: {
              id: booking.id,
              playerId: booking.playerId,
              playerName: booking.playerName,
              date: booking.date,
              startTime: booking.startTime,
              endTime: booking.endTime,
              status: booking.status,
              bookingProducts: [],
            },
          }))
        ),
      },
    });

    it('returns [] and skips updateMany when no future bookings exist', async () => {
      const tx = buildTx([]);
      const result = await service.cancelFutureBookingsForCourt(
        tx as any,
        'court-1',
        'COURT_ARCHIVED',
      );
      expect(result).toEqual([]);
      expect(tx.booking.updateMany).not.toHaveBeenCalled();
    });

    it('cancels future bookings and returns the rows', async () => {
      const rows = [
        {
          id: 'b1',
          playerId: 'p1',
          date: new Date('2026-06-01'),
          startTime: '17:00',
          endTime: '18:00',
        },
        {
          id: 'b2',
          playerId: 'p2',
          date: new Date('2026-06-02'),
          startTime: '18:00',
          endTime: '19:00',
        },
      ];
      const tx = buildTx(rows);
      const result = await service.cancelFutureBookingsForCourt(
        tx as any,
        'court-1',
        'COURT_MAINTENANCE',
      );
      
      const expectedEnriched = rows.map(r => ({
        ...r,
        playerEmail: undefined,
        playerName: undefined,
        courtName: 'San 1',
        centerName: 'PickleDome',
        bookingProducts: [],
      }));

      expect(result).toEqual(expectedEnriched);
      expect(tx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['b1', 'b2'] } },
        data: expect.objectContaining({
          status: 'CANCELLED',
          cancelReason: 'COURT_MAINTENANCE',
        }),
      });
    });

    it('queries with date >= today and PENDING/CONFIRMED status filter', async () => {
      const tx = buildTx([]);
      await service.cancelFutureBookingsForCourt(
        tx as any,
        'court-1',
        'COURT_ARCHIVED',
      );
      expect(tx.bookingItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            courtId: 'court-1',
            booking: expect.objectContaining({
              date: expect.objectContaining({ gte: expect.any(Date) }),
              status: { in: ['PENDING', 'CONFIRMED'] },
            }),
          }),
        }),
      );
    });
  });

  describe('cancelBookingByOwner', () => {
    const ownerUserId = 'owner-1';
    const bookingFixture = {
      id: 'b1',
      courtId: 'c1',
      playerId: 'player-1',
      date: new Date('2026-06-01'),
      startTime: '17:00',
      endTime: '19:00',
      status: 'PENDING',
      center: { id: 'center-1', ownerId: ownerUserId, name: 'PickleDome' },
      court: {
        name: 'San 1',
        center: { id: 'center-1', ownerId: ownerUserId, name: 'PickleDome' },
      },
      bookingItems: [
        {
          id: 'item-1',
          courtId: 'c1',
          startTime: '17:00',
          endTime: '19:00',
          court: { id: 'c1', name: 'San 1' },
        },
      ],
      bookingProducts: [],
    };

    it('throws NotFoundException when booking is missing', async () => {
      prisma.booking.findUnique.mockResolvedValue(null);
      await expect(
        service.cancelBookingByOwner(ownerUserId, 'b1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the center owner', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...bookingFixture,
        center: { ...bookingFixture.center, ownerId: 'someone-else' },
      });
      await expect(
        service.cancelBookingByOwner(ownerUserId, 'b1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it.each(['CANCELLED', 'COMPLETED'])(
      'throws BadRequestException when status is %s',
      async (status) => {
        prisma.booking.findUnique.mockResolvedValue({
          ...bookingFixture,
          status,
        });
        await expect(
          service.cancelBookingByOwner(ownerUserId, 'b1'),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it('cancels the booking and fires notification on success', async () => {
      prisma.booking.findUnique.mockResolvedValue(bookingFixture);
      prisma.booking.update.mockResolvedValue({
        ...bookingFixture,
        status: 'CANCELLED',
        cancelReason: 'OWNER_MANUAL',
      });

      const result = await service.cancelBookingByOwner(ownerUserId, 'b1');

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: expect.objectContaining({
          status: 'CANCELLED',
          cancelReason: 'OWNER_MANUAL',
        }),
      });
      expect(notification.sendBookingCancelledNotification).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            playerId: 'player-1',
            bookingId: 'b1',
          }),
        ],
        'San 1',
        'PickleDome',
        'OWNER_MANUAL',
      );
      expect(result.status).toBe('CANCELLED');
    });

    it('skips notification when booking has no playerId (forward-defensive for walk-ins)', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        ...bookingFixture,
        playerId: null,
      });
      prisma.booking.update.mockResolvedValue({
        ...bookingFixture,
        playerId: null,
        status: 'CANCELLED',
      });

      await service.cancelBookingByOwner(ownerUserId, 'b1');

      expect(prisma.booking.update).toHaveBeenCalled();
      expect(notification.sendBookingCancelledNotification).not.toHaveBeenCalled();
    });
  });
});
