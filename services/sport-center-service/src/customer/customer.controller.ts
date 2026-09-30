import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RequireSubscription } from '../guards/subscription.guard';
import { CenterService } from '../center/center.service';
import { ListCustomersQueryDto } from './dto/list-customers-query.dto';

const customerListExample = {
  scope: {
    centerId: null,
    centers: [
      { id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', name: 'Pickle Dome Sukhumvit' },
      { id: '2b2a1e00-3dd3-4d22-9f25-1fdc7f2f5b31', name: 'Pickle Dome Thonglor' },
    ],
  },
  data: [
    {
      customer: {
        id: 'user-uuid-1234',
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        avatarUrl: 'https://example.com/avatar/sarah.jpg',
        phoneNumber: '+66812345678',
      },
      summary: {
        visitCount: 12,
        completedVisitCount: 9,
        confirmedVisitCount: 2,
        pendingVisitCount: 1,
        cancelledVisitCount: 2,
        totalSpend: 2755000,
        cancelledSpend: 420000,
        creditBalance: 180000,
        firstVisitAt: '2026-01-04T00:00:00.000Z',
        lastVisitAt: '2026-05-26T00:00:00.000Z',
        centerCount: 2,
      },
      centers: [
        {
          centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
          centerName: 'Pickle Dome Sukhumvit',
          visitCount: 8,
          totalSpend: 1845000,
          cancelledVisitCount: 1,
          cancelledSpend: 120000,
          lastVisitAt: '2026-05-26T00:00:00.000Z',
        },
        {
          centerId: '2b2a1e00-3dd3-4d22-9f25-1fdc7f2f5b31',
          centerName: 'Pickle Dome Thonglor',
          visitCount: 4,
          totalSpend: 910000,
          cancelledVisitCount: 1,
          cancelledSpend: 300000,
          lastVisitAt: '2026-05-14T00:00:00.000Z',
        },
      ],
      latestBooking: {
        id: 'booking-uuid-1',
        date: '2026-05-26T00:00:00.000Z',
        status: 'CONFIRMED',
        totalPrice: 315000,
        creditApplied: 0,
        paymentRemaining: 315000,
        cancelReason: null,
        cancelledAt: null,
        center: {
          id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
          name: 'Pickle Dome Sukhumvit',
        },
        createdAt: '2026-05-24T08:03:00.000Z',
      },
    },
  ],
  pagination: {
    limit: 20,
    offset: 0,
    total: 1,
  },
};

const customerDetailExample = {
  scope: {
    centerId: null,
    centers: [
      { id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a', name: 'Pickle Dome Sukhumvit' },
      { id: '2b2a1e00-3dd3-4d22-9f25-1fdc7f2f5b31', name: 'Pickle Dome Thonglor' },
    ],
  },
  customer: {
    id: 'user-uuid-1234',
    name: 'Sarah Johnson',
    email: 'sarah@example.com',
    avatarUrl: 'https://example.com/avatar/sarah.jpg',
    phoneNumber: '+66812345678',
  },
  summary: {
    visitCount: 12,
    completedVisitCount: 9,
    confirmedVisitCount: 2,
    pendingVisitCount: 1,
    cancelledVisitCount: 2,
    totalSpend: 2755000,
    cancelledSpend: 420000,
    creditBalance: 180000,
    cancelledRefundAmount: 420000,
    firstVisitAt: '2026-01-04T00:00:00.000Z',
    lastVisitAt: '2026-05-26T00:00:00.000Z',
  },
  byCenter: [
    {
      centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
      centerName: 'Pickle Dome Sukhumvit',
      creditBalance: 120000,
      visitCount: 8,
      totalSpend: 1845000,
      cancelledVisitCount: 1,
      cancelledSpend: 120000,
      lastVisitAt: '2026-05-26T00:00:00.000Z',
      latestCreditTransaction: {
        id: 'tx-uuid-1',
        bookingId: 'booking-uuid-1',
        amount: 120000,
        type: 'CANCELLATION_REFUND',
        description: '100% preservation credit refund for player-initiated cancellation',
        createdAt: '2026-05-22T10:00:00.000Z',
      },
    },
  ],
  recentBookings: [
    {
      id: 'booking-uuid-1',
      center: {
        id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        name: 'Pickle Dome Sukhumvit',
      },
      date: '2026-05-26T00:00:00.000Z',
      status: 'CONFIRMED',
      totalPrice: 315000,
      creditApplied: 0,
      paymentRemaining: 315000,
      cancelReason: null,
      cancelledAt: null,
      createdAt: '2026-05-24T08:03:00.000Z',
      bookingItems: [
        {
          startTime: '17:00',
          endTime: '19:00',
          itemPrice: 240000,
          court: {
            id: 'court-uuid-1',
            name: 'Court 1',
          },
        },
      ],
    },
  ],
  creditWallets: [
    {
      centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
      centerName: 'Pickle Dome Sukhumvit',
      creditBalance: 120000,
      latestCreditTransaction: {
        id: 'tx-uuid-1',
        bookingId: 'booking-uuid-1',
        amount: 120000,
        type: 'CANCELLATION_REFUND',
        description: '100% preservation credit refund for player-initiated cancellation',
        createdAt: '2026-05-22T10:00:00.000Z',
      },
    },
  ],
};

@ApiTags('Customers')
@Controller('sport-centers/customers')
@RequireSubscription('SPORT_CENTER_MANAGER')
export class CustomerController {
  constructor(private readonly centerService: CenterService) {}

  @Get('list')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List customers across owned centers',
    description:
      'Returns a paginated, aggregated customer list for all centers owned by the logged-in owner. ' +
      'Use `centerId` to narrow the scope to one owned center, or omit it to search across all owned centers.',
  })
  @ApiQuery({ name: 'centerId', required: false, description: 'Optional owned sport center scope' })
  @ApiQuery({ name: 'keyword', required: false, description: 'Search by customer name, phone, or email' })
  @ApiQuery({ name: 'name', required: false, description: 'Filter by customer name' })
  @ApiQuery({ name: 'phone', required: false, description: 'Filter by customer phone number' })
  @ApiQuery({ name: 'email', required: false, description: 'Filter by customer email' })
  @ApiQuery({ name: 'lastVisitFrom', required: false, description: 'Filter by latest visit on or after this date' })
  @ApiQuery({ name: 'lastVisitTo', required: false, description: 'Filter by latest visit on or before this date' })
  @ApiQuery({ name: 'minSpend', required: false, description: 'Minimum total spend in VND' })
  @ApiQuery({ name: 'maxSpend', required: false, description: 'Maximum total spend in VND' })
  @ApiQuery({ name: 'limit', required: false, description: 'Pagination limit' })
  @ApiQuery({ name: 'offset', required: false, description: 'Pagination offset' })
  @ApiResponse({
    status: 200,
    description: 'Customers listed successfully.',
    schema: { example: customerListExample },
  })
  @UseGuards(JwtAuthGuard)
  listCustomers(@Req() req: any, @Query() query: ListCustomersQueryDto) {
    const ownerId = req.user?.userId;
    if (!ownerId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.centerService.listOwnerCustomers(ownerId, query);
  }

  @Get(':customerId')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get a customer profile across owned centers',
    description:
      'Returns an aggregated customer profile with visits, spend, cancellations, credit balances, recent bookings, and per-center breakdowns. ' +
      'Use the optional `centerId` query parameter to scope the profile to one owned center.',
  })
  @ApiQuery({ name: 'centerId', required: false, description: 'Optional owned sport center scope' })
  @ApiResponse({
    status: 200,
    description: 'Customer profile fetched successfully.',
    schema: { example: customerDetailExample },
  })
  @ApiResponse({ status: 404, description: 'Customer not found.' })
  @UseGuards(JwtAuthGuard)
  getCustomerDetail(
    @Req() req: any,
    @Param('customerId', new ParseUUIDPipe()) customerId: string,
    @Query('centerId') centerId?: string,
  ) {
    const ownerId = req.user?.userId;
    if (!ownerId) {
      throw new UnauthorizedException('Unable to identify current user');
    }

    return this.centerService.getOwnerCustomerDetail(ownerId, customerId, centerId);
  }
}
