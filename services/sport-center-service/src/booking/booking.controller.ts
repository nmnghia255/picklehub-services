import {
  Body,
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { BookingService } from './booking.service';
import { BookingCancelService } from './booking-cancel.service';
import { BookingCancelReason } from './booking-cancel-reason';
import { BOOKING_TIMEOUT_MINUTES } from './booking-timeout.service';
import { CreditService } from './credit.service';
import { OwnerBookingService } from './owner-booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { OwnerCreateBookingDto } from './dto/owner-create-booking.dto';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { LinkPlaySessionDto } from './dto/link-play-session.dto';
import { UnlinkPlaySessionDto } from './dto/unlink-play-session.dto';
import { BatchBookingsDto } from './dto/batch-bookings.dto';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';
import { PreviewBookingDto } from './dto/preview-booking.dto';
import { QueryPlayerBookingsDto } from './dto/query-bookings.dto';

const sampleCenter = {
  id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
  ownerId: 'owner-uuid-5678',
  name: 'Pickle Dome Sukhumvit',
  address: '42 Sukhumvit 49, Watthana, Bangkok',
  phone: '+66 2 111 2222',
  email: 'hello@pickledome.com',
  openTime: '06:00',
  closeTime: '23:00',
  basePrice: 80000,
  status: 'ACTIVE',
  amenities: ['Parking', 'Shower'],
  images: [],
  rules: ['Non-marking shoes only'],
  description: 'Pickle Dome Sukhumvit',
  paymentAccountName: 'NGUYEN VAN AN',
  paymentAccountNumber: '1234567890',
  paymentBankName: 'VietcomBank',
  paymentQrUrl: 'https://cdn.example.com/qr/sample-qr.png',
  createdAt: '2026-05-06T08:00:00.000Z',
  updatedAt: '2026-05-06T08:00:00.000Z',
  deletedAt: null,
};

const sampleCourt = {
  id: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
  centerId: sampleCenter.id,
  name: 'San 1',
  type: 'INDOOR',
  status: 'ACTIVE',
  createdAt: '2026-05-06T08:00:00.000Z',
  updatedAt: '2026-05-06T08:00:00.000Z',
};

const sampleService = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  centerId: sampleCenter.id,
  name: 'Racket Rental',
  description: 'Rent a professional pickleball racket',
  type: 'EQUIPMENT_RENTAL',
  imageUrl: 'https://cdn.example.com/services/racket-rental.png',
  price: 25000,
  unit: 'VND / 3h',
  isActive: true,
  createdAt: '2026-05-20T10:00:00.000Z',
  updatedAt: '2026-05-20T10:00:00.000Z',
};

const sampleProduct = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  centerId: sampleCenter.id,
  name: 'Pocari Sweat 500ml',
  description: 'Refreshing sports drink',
  type: 'BEVERAGE',
  imageUrl: 'https://cdn.example.com/products/pocari.png',
  price: 25000,
  unit: 'VND / bottle',
  stock: 100,
  isActive: true,
  createdAt: '2026-05-20T10:00:00.000Z',
  updatedAt: '2026-05-20T10:00:00.000Z',
};

const sampleBookingService = {
  id: 'c1111111-2222-3333-4444-555555555551',
  bookingId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  serviceId: sampleService.id,
  quantity: 1,
  price: 25000,
  createdAt: '2026-05-20T10:00:00.000Z',
  service: sampleService,
};

const sampleBookingProduct = {
  id: 'c1111111-2222-3333-4444-555555555552',
  bookingId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  productId: sampleProduct.id,
  quantity: 2,
  price: 25000,
  createdAt: '2026-05-20T10:00:00.000Z',
  product: sampleProduct,
};

const sampleBooking = {
  id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  centerId: sampleCenter.id,
  playerId: 'user-uuid-1234',
  playerName: 'John Doe',
  phoneNumber: '+66 81 234 5678',
  date: '2026-05-15T00:00:00.000Z',
  status: 'PENDING',
  totalPrice: 630000,
  /// Amount covered by preservation credit (0 when useCredit is false or no credit available)
  creditApplied: 0,
  /// Cash amount the player still needs to transfer
  paymentRemaining: 315000,
  note: 'Need extra balls',
  playSessionId: null,
  paymentProofUrl: null,
  paymentProofUploadedAt: null,
  /// ISO timestamp when this PENDING booking will be auto-cancelled if no payment proof is uploaded.
  /// null when status is CONFIRMED (fully paid by credit or confirmed by owner).
  /// Frontend should display a countdown timer based on this value.
  expiresAt: '2026-05-06T08:10:00.000Z',
  /// Timeout duration in minutes (system-wide constant). null when status is CONFIRMED.
  /// Frontend can use this to display "You have X minutes to pay" messaging.
  bookingTimeoutMinutes: BOOKING_TIMEOUT_MINUTES,
  createdAt: '2026-05-06T08:00:00.000Z',
  updatedAt: '2026-05-06T08:00:00.000Z',
  cancelledAt: null,
  cancelReason: null,
  center: sampleCenter,
  bookingItems: [
    {
      id: 'i1111111-2222-3333-4444-555555555551',
      bookingId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      courtId: sampleCourt.id,
      startTime: '17:00',
      endTime: '19:00',
      itemPrice: 240000,
      createdAt: '2026-05-06T08:00:00.000Z',
      court: sampleCourt,
    },
    {
      id: 'i1111111-2222-3333-4444-555555555552',
      bookingId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      courtId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      startTime: '19:00',
      endTime: '21:00',
      itemPrice: 240000,
      createdAt: '2026-05-06T08:00:00.000Z',
      court: {
        ...sampleCourt,
        id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        name: 'San 2',
      },
    },
  ],
  bookingServices: [sampleBookingService],
  bookingProducts: [sampleBookingProduct],
  items: [
    {
      courtId: sampleCourt.id,
      courtName: sampleCourt.name,
      startTime: '17:00',
      endTime: '19:00',
      durationHours: 2,
      breakdown: [
        { startTime: '17:00', endTime: '17:30', pricePerHour: 120000 },
        { startTime: '17:30', endTime: '18:00', pricePerHour: 120000 },
        { startTime: '18:00', endTime: '18:30', pricePerHour: 120000 },
        { startTime: '18:30', endTime: '19:00', pricePerHour: 120000 },
      ],
      courtPrice: 240000,
    },
    {
      courtId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      courtName: 'San 2',
      startTime: '19:00',
      endTime: '21:00',
      durationHours: 2,
      breakdown: [
        { startTime: '19:00', endTime: '19:30', pricePerHour: 120000 },
        { startTime: '19:30', endTime: '20:00', pricePerHour: 120000 },
        { startTime: '20:00', endTime: '20:30', pricePerHour: 120000 },
        { startTime: '20:30', endTime: '21:00', pricePerHour: 120000 },
      ],
      courtPrice: 240000,
    },
  ],
  bookingCount: 2,
  totalCourtPrice: 480000,
  totalServicePrice: 50000,
  totalProductPrice: 100000,
  services: [
    {
      id: sampleService.id,
      name: sampleService.name,
      price: sampleService.price,
      unit: sampleService.unit,
      quantity: 1,
      lineTotal: 25000,
    },
  ],
  products: [
    {
      id: sampleProduct.id,
      name: sampleProduct.name,
      price: sampleProduct.price,
      unit: sampleProduct.unit,
      stock: sampleProduct.stock,
      quantity: 2,
      lineTotal: 50000,
    },
  ],
  servicePricePerItem: 25000,
  productPricePerItem: 50000,
};

const sampleCreateBookingsResponse = {
  ...sampleBooking,
  creditApplied: 120000,
  paymentRemaining: 510000,
  status: 'PENDING',
  expiresAt: '2026-05-06T08:10:00.000Z',
  bookingTimeoutMinutes: BOOKING_TIMEOUT_MINUTES,
};

const sampleOwnerCreateBookingResponse = {
  ...sampleBooking,
  creditApplied: 0,
  paymentRemaining: 0,
  status: 'CONFIRMED',
  expiresAt: null,
  bookingTimeoutMinutes: null,
};

const samplePreviewBooking = {
  centerId: sampleCenter.id,
  date: '2026-05-15',
  bookingCount: 2,
  items: [
    {
      courtId: sampleCourt.id,
      courtName: sampleCourt.name,
      startTime: '17:00',
      endTime: '19:00',
      durationHours: 2,
      breakdown: [
        { startTime: '17:00', endTime: '17:30', pricePerHour: 120000 },
        { startTime: '17:30', endTime: '18:00', pricePerHour: 120000 },
        { startTime: '18:00', endTime: '18:30', pricePerHour: 120000 },
        { startTime: '18:30', endTime: '19:00', pricePerHour: 120000 },
      ],
      courtPrice: 240000,
    },
    {
      courtId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      courtName: 'San 2',
      startTime: '19:00',
      endTime: '21:00',
      durationHours: 2,
      breakdown: [
        { startTime: '19:00', endTime: '19:30', pricePerHour: 120000 },
        { startTime: '19:30', endTime: '20:00', pricePerHour: 120000 },
        { startTime: '20:00', endTime: '20:30', pricePerHour: 120000 },
        { startTime: '20:30', endTime: '21:00', pricePerHour: 120000 },
      ],
      courtPrice: 240000,
    },
  ],
  totalCourtPrice: 480000,
  services: [
    {
      id: sampleService.id,
      name: sampleService.name,
      price: sampleService.price,
      unit: sampleService.unit,
      quantity: 1,
      lineTotal: 25000,
    },
  ],
  servicePrice: 25000,
  products: [
    {
      id: sampleProduct.id,
      name: sampleProduct.name,
      price: sampleProduct.price,
      unit: sampleProduct.unit,
      stock: sampleProduct.stock,
      quantity: 2,
      lineTotal: 50000,
    },
  ],
  productPrice: 50000,
  totalPrice: 555000,
};


@ApiTags('Bookings')
@Controller()
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly bookingCancel: BookingCancelService,
    private readonly creditService: CreditService,
    private readonly ownerBooking: OwnerBookingService,
  ) { }

  @Get('sport-centers/:centerId/courts/:courtId/availability')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get court availability' })
  @ApiResponse({
    status: 200,
    description: 'Availability fetched successfully.',
    schema: {
      example: {
        date: '2026-05-15',
        courtId: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        slots: [
          {
            startTime: '06:00',
            endTime: '06:30',
            available: true,
            pricePerHour: 80000
          },
          {
            startTime: '06:30',
            endTime: '07:00',
            available: false,
            pricePerHour: 80000
          }
        ]
      }
    }
  })
  @UseGuards(JwtAuthGuard)
  getAvailability(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Param('courtId', new ParseUUIDPipe()) courtId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.bookingService.getAvailability(centerId, courtId, query.date);
  }

  @Get('sport-centers/:centerId/availability')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get bulk court availability',
    description:
      'Returns 30-minute availability slots for ALL active courts in the center for a given date. ' +
      'Use this instead of calling the per-court availability endpoint N times.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk availability fetched successfully.',
    schema: {
      example: {
        date: '2026-05-15',
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        courtCount: 8,
        courts: [
          {
            courtId: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
            courtName: 'Sân 1',
            slots: [
              { startTime: '06:00', endTime: '06:30', available: true,  pricePerHour: 80000 },
              { startTime: '06:30', endTime: '07:00', available: false, pricePerHour: 80000 },
              { startTime: '07:00', endTime: '07:30', available: true,  pricePerHour: 80000 },
            ],
          },
          {
            courtId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
            courtName: 'Sân 2',
            slots: [
              { startTime: '06:00', endTime: '06:30', available: true,  pricePerHour: 80000 },
              { startTime: '06:30', endTime: '07:00', available: true,  pricePerHour: 80000 },
              { startTime: '07:00', endTime: '07:30', available: false, pricePerHour: 80000 },
            ],
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Sport center not found or not active.' })
  @UseGuards(JwtAuthGuard)
  getBulkAvailability(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.bookingService.getBulkAvailability(centerId, query.date);
  }

  @Post('sport-centers/:centerId/bookings/preview')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Preview booking price',
    description:
      'Calculates the total price for one or more court-time selections without creating bookings. ' +
      'This endpoint is preview-only and does not create any booking. ' +
      'POST is used to avoid URL-size limits when sending line items.',
  })
  @ApiResponse({
    status: 200,
    description: 'Price preview calculated successfully.',
    schema: {
      example: samplePreviewBooking,
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid time range or outside operating hours.' })
  @ApiResponse({ status: 404, description: 'Court not found or inactive.' })
  @ApiBody({ type: PreviewBookingDto, description: 'Preview booking payload. The request is used for price calculation only and does not create a booking.' })
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  previewBooking(
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Body() dto: PreviewBookingDto,
  ) {
    return this.bookingService.previewBooking(centerId, dto);
  }

  @Post('sport-centers/:centerId/bookings')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create one or more court bookings (single or multi-day)',
    description:
      'Creates court bookings (one per date) containing one or more booked court-time items within the selected center. ' +
      '\n\n**Without credit (`useCredit: false` or omitted):** bookings start as PENDING. ' +
      'The response includes center payment info so the player ' +
      'can immediately make a bank transfer. ' +
      'After transferring, upload proof via `PATCH /bookings/:bookingId/payment-proof`.' +
      '\n\n**With credit (`useCredit: true`):** available preservation credit at this sport center ' +
      'is deducted from `totalPrice`. ' +
      'If credit fully covers the amount (`paymentRemaining === 0`) the bookings are instantly ' +
      'set to **CONFIRMED** — no payment proof required. ' +
      'If credit only partially covers it, the bookings stay PENDING and the player must pay ' +
      'the remaining `paymentRemaining` amount.' +
      `\n\n**⏱️ Payment timeout:** PENDING bookings are automatically cancelled after **${BOOKING_TIMEOUT_MINUTES} minutes** ` +
      'if no payment proof is uploaded. The response includes `expiresAt` (ISO timestamp) and ' +
      '`bookingTimeoutMinutes` — use these to display a countdown timer on the payment screen. ' +
      'Both fields are `null` when the booking is instantly CONFIRMED via full credit.',
  })
  @ApiResponse({
    status: 201,
    description: 'Bookings created successfully.',
    schema: {
      type: 'array',
      items: {
        example: sampleCreateBookingsResponse,
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  createBooking(
    @Req() req: any,
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Body() dto: CreateBookingDto,
  ) {
    const playerId = req.user?.userId;
    if (!playerId) throw new UnauthorizedException();
    return this.bookingService.createBooking(playerId, centerId, dto);
  }

  @Get('bookings/me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get my bookings' })
  @ApiResponse({
    status: 200,
    description: 'My bookings fetched successfully.',
    schema: {
      example: {
        data: [
          sampleBooking,
        ],
        pagination: {
          limit: 20,
          offset: 0,
          total: 1
        }
      }
    }
  })
  @UseGuards(JwtAuthGuard)
  getMyBookings(@Req() req: any, @Query() query: ListBookingsQueryDto) {
    const playerId = req.user?.userId;
    if (!playerId) throw new UnauthorizedException();
    return this.bookingService.getMyBookings(playerId, query);
  }

  @Get('bookings/credits')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get my preservation credit wallets',
    description:
      'Returns all preservation credit balances the logged-in player holds across sport centers. ' +
      'Includes center name and images for display.',
  })
  @ApiResponse({
    status: 200,
    description: 'Credit wallets fetched successfully.',
    schema: {
      example: [
        {
          id: 'wallet-uuid-1',
          playerId: 'user-uuid-1234',
          centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
          balance: 240000,
          center: {
            id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
            name: 'Pickle Dome Sukhumvit',
            address: '42 Sukhumvit 49, Watthana, Bangkok',
            images: ['https://example.com/image1.jpg'],
          },
          transactions: [
            {
              id: 'tx-uuid-1',
              bookingId: 'booking-uuid-1',
              amount: 240000,
              type: 'CANCELLATION_REFUND',
              description: '100% preservation credit refund for player-initiated cancellation',
              createdAt: '2026-05-22T10:00:00.000Z',
              booking: {
                id: 'booking-uuid-1',
                date: '2026-05-20T00:00:00.000Z',
                startTime: '17:00',
                endTime: '19:00',
                status: 'CANCELLED',
                totalPrice: 240000,
                creditApplied: 0,
                paymentRemaining: 0,
                center: { id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', name: 'Pickle Dome Sukhumvit' },
                bookingItems: [
                  { startTime: '17:00', endTime: '18:00', itemPrice: 120000, court: { id: 'court-uuid-1', name: 'Court 1' } },
                  { startTime: '18:00', endTime: '19:00', itemPrice: 120000, court: { id: 'court-uuid-1', name: 'Court 1' } },
                ],
              }
            }
          ],
          updatedAt: '2026-05-22T10:00:00.000Z',
        },
      ],
    },
  })
  @UseGuards(JwtAuthGuard)
  getMyCredits(@Req() req: any) {
    const playerId = req.user?.userId;
    if (!playerId) throw new UnauthorizedException();
    return this.creditService.getPlayerWallets(playerId);
  }

  @Get('bookings/credits/:centerId/balance')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get my preservation credit balance for a center',
    description:
      'Returns only the logged-in player\'s preservation credit balance at a specific sport center. ' +
      'If the player has no credit wallet yet, returns balance = 0.',
  })
  @ApiResponse({
    status: 200,
    description: 'Credit balance fetched successfully.',
    schema: {
      example: {
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        balance: 240000,
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  getMyCreditBalance(
    @Req() req: any,
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
  ) {
    const playerId = req.user?.userId;
    if (!playerId) throw new UnauthorizedException();
    return this.creditService.getPlayerBalance(playerId, centerId);
  }

  @Get('bookings/credits/:centerId/transactions')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get preservation credit transaction history',
    description:
      'Returns the credit transaction history for the logged-in player at a specific sport center.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'Credit transaction history fetched successfully.',
    schema: {
      example: {
        balance: 240000,
        center: { id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', name: 'Pickle Dome Sukhumvit' },
        transactions: [
          {
            id: 'tx-uuid-1',
            bookingId: 'booking-uuid-1',
            amount: 240000,
            type: 'CANCELLATION_REFUND',
            description: '100% preservation credit refund for player-initiated cancellation',
            createdAt: '2026-05-22T10:00:00.000Z',
            booking: {
              id: 'booking-uuid-1',
              date: '2026-05-20T00:00:00.000Z',
              startTime: '17:00',
              endTime: '19:00',
              status: 'CANCELLED',
              totalPrice: 240000,
              creditApplied: 0,
              paymentRemaining: 0,
              center: { id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', name: 'Pickle Dome Sukhumvit' },
              bookingItems: [
                { startTime: '17:00', endTime: '18:00', itemPrice: 120000, court: { id: 'court-uuid-1', name: 'Court 1' } },
                { startTime: '18:00', endTime: '19:00', itemPrice: 120000, court: { id: 'court-uuid-1', name: 'Court 1' } },
              ],
            }
          },
          {
            id: 'tx-uuid-2',
            bookingId: 'booking-uuid-2',
            amount: -120000,
            type: 'BOOKING_PAYMENT',
            description: 'Preservation credit applied to booking',
            createdAt: '2026-05-22T11:00:00.000Z',
            booking: {
              id: 'booking-uuid-2',
              date: '2026-05-21T00:00:00.000Z',
              startTime: '08:00',
              endTime: '10:00',
              status: 'PENDING',
              totalPrice: 320000,
              creditApplied: 120000,
              paymentRemaining: 200000,
              center: { id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', name: 'Pickle Dome Sukhumvit' },
              bookingItems: [
                { startTime: '08:00', endTime: '09:00', itemPrice: 160000, court: { id: 'court-uuid-2', name: 'Court 2' } },
                { startTime: '09:00', endTime: '10:00', itemPrice: 160000, court: { id: 'court-uuid-2', name: 'Court 2' } },
              ],
            }
          },
        ],
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  getCreditTransactions(
    @Req() req: any,
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const playerId = req.user?.userId;
    if (!playerId) throw new UnauthorizedException();
    return this.creditService.getPlayerTransactions(
      playerId,
      centerId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('bookings/:bookingId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get booking details' })
  @ApiResponse({
    status: 200,
    description: 'Booking details fetched successfully.',
    schema: {
      example: sampleBooking,
    }
  })
  @UseGuards(JwtAuthGuard)
  getBookingDetail(
    @Req() req: any,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    const playerId = req.user?.userId;
    if (!playerId) throw new UnauthorizedException();
    return this.bookingService.getBookingDetail(playerId, bookingId);
  }

  @Patch('bookings/:bookingId/cancel')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cancel my booking',
    description:
      'Player cancels their own booking. Behavior depends on booking status and center policy:' +
      '\n\n**PENDING booking:** always cancellable. ' +
      'Any preservation credit that was applied at checkout (`creditApplied`) is immediately returned to the player\'s wallet.' +
      '\n\n**CONFIRMED booking:** only allowed when the center has `allowCancellation: true`. ' +
      'The center\'s cancellation tiers determine the refund percentage based on how many whole days ' +
      'remain before the booking start time. ' +
      'The refund is issued as preservation credit (not cash). ' +
      'If no tier qualifies (e.g. cancellation is too close to start time), 0% is refunded.' +
      '\n\n**COMPLETED / CANCELLED:** not cancellable.',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled successfully.',
    schema: {
      example: {
        ...sampleBooking,
        status: 'CANCELLED',
        creditApplied: 0,
        paymentRemaining: 315000,
        updatedAt: '2026-05-06T08:05:00.000Z',
        cancelledAt: '2026-05-06T08:05:00.000Z',
        cancelReason: 'PLAYER_CANCEL',
        // Preservation credit earned (shown for illustration — returned in the wallet, not in this response)
        // e.g. if center policy gives 75% and totalPrice was 315000 -> 236250 added to player wallet
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Booking already cancelled/completed, or center does not allow cancellations.' })
  @ApiQuery({
    name: 'cancel_reason',
    required: false,
    description: 'Optional free-text reason for cancellation. Defaults to PLAYER_CANCEL for users.',
  })
  @UseGuards(JwtAuthGuard)
  cancelBooking(
    @Req() req: any,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Query('cancel_reason') cancelReason?: string,
  ) {
    const playerId = req.user?.userId;
    if (!playerId) throw new UnauthorizedException();
    return this.bookingService.cancelBooking(playerId, bookingId, parseCancelReason(cancelReason, 'PLAYER_CANCEL'));
  }

  @Patch('bookings/:bookingId/payment-proof')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Submit payment proof (player action)',
    description:
      'Player uploads the URL of their bank transfer screenshot. ' +
      'The booking must be in PENDING status. ' +
      `**Must be submitted within ${BOOKING_TIMEOUT_MINUTES} minutes** of booking creation (before \`expiresAt\`), ` +
      'otherwise the booking will be automatically cancelled. ' +
      'Once proof is uploaded, the booking is safe from auto-cancellation. ' +
      'The center owner will then review the proof and confirm or cancel the booking.',
  })
  @ApiBody({ type: SubmitPaymentProofDto })
  @ApiResponse({
    status: 200,
    description: 'Payment proof submitted successfully.',
    schema: {
      example: {
        ...sampleBooking,
        paymentProofUrl: 'https://cdn.example.com/proofs/transfer-receipt.jpg',
        paymentProofUploadedAt: '2026-05-06T08:03:00.000Z',
        updatedAt: '2026-05-06T08:03:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Booking is not in PENDING status.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  @UseGuards(JwtAuthGuard)
  submitPaymentProof(
    @Req() req: any,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: SubmitPaymentProofDto,
  ) {
    const playerId = req.user?.userId;
    if (!playerId) throw new UnauthorizedException();
    return this.bookingService.submitPaymentProof(playerId, bookingId, dto.paymentProofUrl);
  }

  @Patch('bookings/:bookingId/cancel-by-owner')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cancel a booking (owner action)',
    description:
      'Owner of the sport center cancels a single booking. ' +
      'Sets status to CANCELLED with cancelReason=OWNER_MANUAL and notifies the affected player. ' +
      '\n\n**Preservation credit:** if the cancelled booking was CONFIRMED, the player automatically ' +
      'receives **100% of `totalPrice`** back as preservation credit at this sport center — ' +
      'regardless of the center\'s cancellation tier policy (owner fault = full refund).',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled successfully. Player receives full preservation credit if booking was CONFIRMED.',
    schema: {
      example: {
        ...sampleBooking,
        status: 'CONFIRMED', // was CONFIRMED before cancellation
        creditApplied: 0,
        paymentRemaining: 0,
        cancelReason: 'OWNER_MANUAL',
        updatedAt: '2026-05-06T08:05:00.000Z',
        cancelledAt: '2026-05-06T08:05:00.000Z',
        // Player's preservation credit wallet is credited 315000 automatically
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Booking is already cancelled/completed.' })
  @ApiResponse({ status: 403, description: 'Caller is not the owner of the sport center.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  @ApiQuery({
    name: 'cancel_reason',
    required: false,
    description: 'Optional free-text reason for cancellation. Defaults to OWNER_MANUAL for owners.',
  })
  @UseGuards(JwtAuthGuard)
  cancelBookingByOwner(
    @Req() req: any,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Query('cancel_reason') cancelReason?: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.bookingCancel.cancelBookingByOwner(userId, bookingId, parseCancelReason(cancelReason, 'OWNER_MANUAL'));
  }

  // ==========================================
  // Owner Booking Management
  // ==========================================

  @Post('sport-centers/:centerId/bookings/by-owner')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Create one or more court bookings for a player (owner action)',
    description:
      'Owner creates one booking aggregate with one or more court-time items for a walk-in or offline player. ' +
      'The booking is automatically CONFIRMED and can include services, products, and an optional retyped phone number.',
  })
  @ApiResponse({
    status: 201,
    description: 'Booking created successfully.',
    schema: {
      example: sampleOwnerCreateBookingResponse,
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid time range or outside operating hours.' })
  @ApiResponse({ status: 403, description: 'Caller is not the owner of the sport center.' })
  @ApiResponse({ status: 404, description: 'Court not found or inactive.' })
  @UseGuards(JwtAuthGuard)
  createBookingByOwner(
    @Req() req: any,
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Body() dto: OwnerCreateBookingDto,
  ) {
    const ownerId = req.user?.userId;
    if (!ownerId) throw new UnauthorizedException();
    return this.ownerBooking.createBookingByOwner(ownerId, centerId, dto);
  }

  @Get('sport-centers/:centerId/bookings')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List bookings for a center (owner action)',
    description: 'Owner can list all bookings for their center with pagination and filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bookings listed successfully.',
    schema: {
      example: {
        data: [
          {
            ...sampleBooking,
            status: 'PENDING',
            player: {
              id: 'user-uuid-1234',
              name: 'Sarah Johnson',
              email: 'sarah@example.com',
              avatarUrl: 'https://example.com/avatar.jpg'
            }
          }
        ],
        pagination: {
          limit: 20,
          offset: 0,
          total: 1
        }
      }
    }
  })
  @UseGuards(JwtAuthGuard)
  listCenterBookings(
    @Req() req: any,
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Query() query: ListBookingsQueryDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.ownerBooking.listCenterBookings(userId, centerId, query);
  }

  @Get('sport-centers/:centerId/bookings/:bookingId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get single booking detail (owner action)',
    description: 'Owner can get full details of a specific booking at their center.',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking fetched successfully.',
    schema: {
      example: {
        ...sampleBooking,
        court: {
          ...sampleCourt,
          center: {
            id: sampleCenter.id,
            ownerId: sampleCenter.ownerId,
            name: sampleCenter.name,
          },
        },
        player: {
          id: 'user-uuid-1234',
          name: 'Sarah Johnson',
          email: 'sarah@example.com',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Caller is not the owner of the sport center.' })
  @ApiResponse({ status: 404, description: 'Booking or sport center not found.' })
  @UseGuards(JwtAuthGuard)
  getCenterBookingDetail(
    @Req() req: any,
    @Param('centerId', new ParseUUIDPipe()) centerId: string,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.ownerBooking.getCenterBookingDetail(userId, centerId, bookingId);
  }

  @Patch('bookings/:bookingId/confirm')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Confirm a booking (owner action)',
    description: 'Owner confirms a PENDING booking. A notification is sent to the player.',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking confirmed successfully.',
    schema: {
      example: {
        ...sampleBooking,
        status: 'CONFIRMED',
        updatedAt: '2026-05-06T08:05:00.000Z',
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Booking is not in PENDING status.' })
  @ApiResponse({ status: 403, description: 'Caller is not the owner of the sport center.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  @UseGuards(JwtAuthGuard)
  confirmBooking(
    @Req() req: any,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.ownerBooking.confirmBooking(userId, bookingId);
  }

  @Patch('bookings/:bookingId/complete')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Complete a booking (owner action)',
    description: 'Owner marks a CONFIRMED booking as COMPLETED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking completed successfully.',
    schema: {
      example: {
        ...sampleBooking,
        status: 'COMPLETED',
        updatedAt: '2026-05-06T19:00:00.000Z',
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Booking is not in CONFIRMED status.' })
  @ApiResponse({ status: 403, description: 'Caller is not the owner of the sport center.' })
  @ApiResponse({ status: 404, description: 'Booking not found.' })
  @UseGuards(JwtAuthGuard)
  completeBooking(
    @Req() req: any,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException();
    return this.ownerBooking.completeBooking(userId, bookingId);
  }

  // ==========================================
  // Internal APIs
  // ==========================================

  @Post('bookings/batch')
  @ApiSecurity('internal-service-token')
  @ApiOperation({
    summary: 'Get booking info batch (internal)',
    description: 'Fetch booking details for a list of booking IDs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking infos fetched successfully.',
    schema: {
      example: {
        bookingInfos: [
          {
            id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
            date: '2026-05-15T00:00:00.000Z',
            status: 'CONFIRMED',
            totalPrice: 280000,
            center: {
              id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
              name: 'Pickle Dome Sukhumvit',
              address: '42 Sukhumvit 49, Bangkok',
            },
            bookingItems: [
              {
                id: 'c1d2e3f4-a5b6-7c8d-9e0f-1a2b3c4d5e6f',
                courtId: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
                startTime: '17:00',
                endTime: '19:00',
                court: {
                  id: 'f21ddb56-dd63-4e92-9b01-e3bc6784b972',
                  name: 'San 1',
                },
              },
              {
                id: 'd2e3f4a5-b6c7-8d9e-0f1a-2b3c4d5e6f7a',
                courtId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
                startTime: '17:00',
                endTime: '19:00',
                court: {
                  id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
                  name: 'San 2',
                },
              },
            ],
          },
          {
            id: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
            date: '2026-05-15T00:00:00.000Z',
            status: 'CONFIRMED',
            totalPrice: 140000,
            center: {
              id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
              name: 'Pickle Dome Sukhumvit',
              address: '42 Sukhumvit 49, Bangkok',
            },
            bookingItems: [
              {
                id: 'e3f4a5b6-c7d8-9e0f-1a2b-3c4d5e6f7a8b',
                courtId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
                startTime: '19:00',
                endTime: '21:00',
                court: {
                  id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
                  name: 'San 2',
                },
              },
            ],
          },
        ],
      },
    },
  })
  @UseGuards(InternalServiceGuard)
  getBookingBatch(@Body() dto: BatchBookingsDto) {
    return this.bookingService.getBookingsByIds(dto.bookingIds);
  }

  @Post('bookings/link-play-session')
  @ApiSecurity('internal-service-token')
  @ApiOperation({
    summary: 'Link bookings to play session (internal)',
    description: 'Sets playSessionId for multiple bookings.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bookings linked successfully.',
    schema: {
      example: {
        message: 'Bookings linked successfully',
        data: { updatedCount: 2 },
      },
    },
  })
  @UseGuards(InternalServiceGuard)
  linkPlaySession(@Body() dto: LinkPlaySessionDto) {
    return this.bookingService.linkPlaySession(dto);
  }

  @Post('bookings/unlink-play-session')
  @ApiSecurity('internal-service-token')
  @ApiOperation({
    summary: 'Unlink bookings from play session (internal)',
    description: 'Clears playSessionId for multiple bookings.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bookings unlinked successfully.',
    schema: {
      example: {
        message: 'Bookings unlinked successfully',
        data: { updatedCount: 2 },
      },
    },
  })
  @UseGuards(InternalServiceGuard)
  unlinkPlaySession(@Body() dto: UnlinkPlaySessionDto) {
    return this.bookingService.unlinkPlaySession(dto);
  }

  @Post('bookings/internal/query-by-player')
  @ApiSecurity('internal-service-token')
  @ApiOperation({
    summary: 'Query bookings by player (internal)',
    description: 'Retrieves non-cancelled bookings of a player within date range.',
  })
  @UseGuards(InternalServiceGuard)
  queryPlayerBookingsInternal(@Body() dto: QueryPlayerBookingsDto) {
    return this.bookingService.queryPlayerBookings(dto.playerId, dto.startDate, dto.endDate);
  }

  @Get('bookings/internal/:bookingId/cancellation-policy')
  @ApiSecurity('internal-service-token')
  @ApiOperation({
    summary: 'Query booking cancellation policy eligibility (internal)',
    description: 'Calculates refund eligibility and builds user warnings.',
  })
  @UseGuards(InternalServiceGuard)
  getCancellationPolicyInternal(
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    return this.bookingService.checkCancelEligibilityInternal(bookingId);
  }

  @Post('bookings/internal/:bookingId/cancel')
  @ApiSecurity('internal-service-token')
  @ApiOperation({
    summary: 'Cancel booking internally (internal)',
    description: 'Cancels the booking bypassing user token checks.',
  })
  @UseGuards(InternalServiceGuard)
  cancelBookingInternal(
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: { cancelReason?: string },
  ) {
    return this.bookingService.cancelBookingInternal(
      bookingId,
      parseCancelReason(dto.cancelReason, 'PLAYER_CANCEL'),
    );
  }
}


function parseCancelReason(value: string | undefined, fallback: BookingCancelReason): BookingCancelReason {
  const reason = value?.trim();
  return reason ? reason : fallback;
}
