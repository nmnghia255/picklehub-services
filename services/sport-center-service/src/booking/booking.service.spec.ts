import { Test } from '@nestjs/testing';
import { BookingService } from './booking.service';
import { PrismaService } from '../prisma.service';
import { CreditService } from './credit.service';
import { PaymentTransactionService } from './payment-transaction.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BadRequestException } from '@nestjs/common';

describe('BookingService', () => {
  let service: BookingService;
  let prisma: any;
  let creditService: any;
  let paymentTransactions: any;

  const mockCourt = {
    id: 'court-1',
    centerId: 'center-1',
    status: 'ACTIVE',
    center: {
      status: 'ACTIVE',
      openTime: '08:00',
      closeTime: '22:00',
      basePrice: 100000,
      priceSlots: [],
    },
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
      court: {
        findMany: jest.fn().mockResolvedValue([mockCourt]),
      },
      bookingItem: {
        findFirst: jest.fn(),
      },
      product: {
        updateMany: jest.fn(),
      },
      booking: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    creditService = {
      applyCreditToBooking: jest.fn(),
    };

    paymentTransactions = {};

    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: prisma },
        { provide: CreditService, useValue: creditService },
        { provide: PaymentTransactionService, useValue: paymentTransactions },
      ],
    }).compile();

    service = moduleRef.get(BookingService);
  });

  describe('createBooking', () => {
    it('creates multiple bookings within a single transaction', async () => {
      prisma.court.findMany.mockResolvedValue([mockCourt]);
      prisma.bookingItem.findFirst.mockResolvedValue(null);
      
      const mockBooking = {
        id: 'booking-1',
        createdAt: new Date(),
        bookingItems: [],
        bookingServices: [],
        bookingProducts: [],
        center: {
          id: 'center-1',
          name: 'Sport Center 1',
        },
      };
      prisma.booking.create.mockResolvedValue(mockBooking);

      const dto: CreateBookingDto = {
        bookings: [
          {
            date: '2026-07-20',
            items: [{ courtId: 'court-1', startTime: '09:00', endTime: '10:00' }],
          },
          {
            date: '2026-07-21',
            items: [{ courtId: 'court-1', startTime: '09:00', endTime: '10:00' }],
          },
        ],
        playerName: 'Test Organizer',
        phoneNumber: '0900000000',
        useCredit: false,
      };

      const result = await service.createBooking('player-1', 'center-1', dto);
      expect(result).toHaveLength(2);
      expect(prisma.court.findMany).toHaveBeenCalled();
      expect(prisma.booking.create).toHaveBeenCalledTimes(2);
    });

    it('throws BadRequestException if booking date is in the past', async () => {
      const dto: CreateBookingDto = {
        bookings: [
          {
            date: '2020-01-01',
            items: [{ courtId: 'court-1', startTime: '09:00', endTime: '10:00' }],
          },
        ],
        playerName: 'Test Organizer',
        phoneNumber: '0900000000',
        useCredit: false,
      };

      await expect(
        service.createBooking('player-1', 'center-1', dto),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

