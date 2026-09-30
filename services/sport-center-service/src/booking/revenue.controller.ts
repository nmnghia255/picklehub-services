import { Controller, Get, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PaymentTransactionService } from './payment-transaction.service';
import { RevenueExportQueryDto, RevenueQueryDto, RevenueStatisticsQueryDto } from './dto/revenue-query.dto';
import { RequireSubscription } from '../guards/subscription.guard';

const revenueSummaryExample = {
  centerId: null,
  period: {
    from: '2026-05-01',
    to: '2026-05-31',
  },
  totalSettledRevenue: 1845000,
  totalPendingRevenue: 315000,
  settledTransactionCount: 12,
  pendingTransactionCount: 3,
  byCenter: [
    {
      centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
      centerName: 'Pickle Dome Sukhumvit',
      settledRevenue: 1250000,
      pendingRevenue: 120000,
      settledTransactionCount: 8,
      pendingTransactionCount: 1,
    },
  ],
};

const revenueTransactionsExample = {
  data: [
    {
      id: 'ptx-uuid-1',
      bookingId: 'booking-uuid-1',
      centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
      playerId: 'user-uuid-1234',
      amount: 315000,
      method: 'BANK_TRANSFER',
      status: 'PENDING_REVIEW',
      proofUrl: 'https://cdn.example.com/proofs/transfer-receipt.jpg',
      receivedAt: null,
      reviewedAt: null,
      rejectedAt: null,
      rejectedReason: null,
      createdAt: '2026-05-06T08:03:00.000Z',
      updatedAt: '2026-05-06T08:03:00.000Z',
      center: {
        id: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        name: 'Pickle Dome Sukhumvit',
      },
      booking: {
        id: 'booking-uuid-1',
        date: '2026-05-06T00:00:00.000Z',
        status: 'PENDING',
        totalPrice: 315000,
        creditApplied: 0,
        paymentRemaining: 315000,
        paymentProofUrl: 'https://cdn.example.com/proofs/transfer-receipt.jpg',
        paymentProofUploadedAt: '2026-05-06T08:03:00.000Z',
      },
    },
  ],
  pagination: {
    limit: 20,
    offset: 0,
    total: 1,
  },
};

const revenueStatisticsExample = {
  centerId: null,
  period: {
    from: '2026-05-01',
    to: '2026-05-31',
  },
  cashRevenue: revenueSummaryExample,
  grossRevenue: {
    totalCourtRevenue: 2160000,
    totalServiceRevenue: 420000,
    totalProductRevenue: 175000,
    totalRevenue: 2755000,
    bookingCount: 18,
    serviceLineCount: 14,
    productLineCount: 9,
    byCenter: [
      {
        centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
        centerName: 'Pickle Dome Sukhumvit',
        courtRevenue: 1460000,
        serviceRevenue: 240000,
        productRevenue: 85000,
        grossRevenue: 1785000,
        bookingCount: 10,
        serviceLineCount: 8,
        productLineCount: 4,
      },
    ],
  },
};

const revenueDailyStatisticsExample = {
  centerId: null,
  period: {
    from: '2026-05-01',
    to: '2026-05-31',
  },
  byDay: [
    {
      date: '2026-05-01',
      courtRevenue: 480000,
      serviceRevenue: 120000,
      productRevenue: 45000,
      grossRevenue: 645000,
      settledCashRevenue: 315000,
      pendingCashRevenue: 120000,
      bookingCount: 3,
      settledTransactionCount: 2,
      pendingTransactionCount: 1,
    },
  ],
};

const revenueCancellationExample = {
  centerId: null,
  period: {
    from: '2026-05-01',
    to: '2026-05-31',
  },
  totalCancelledBookingCount: 4,
  totalCancelledRevenue: 930000,
  totalRefundedCreditAmount: 390000,
  byCenter: [
    {
      centerId: '9d3d7b25-aeeb-4e23-a7dd-c8f319275d1a',
      centerName: 'Pickle Dome Sukhumvit',
      cancelledBookingCount: 2,
      cancelledRevenue: 420000,
      refundedCreditAmount: 180000,
    },
  ],
  byReason: [
    {
      cancelReason: 'OWNER_MANUAL',
      cancelledBookingCount: 2,
      cancelledRevenue: 420000,
      refundedCreditAmount: 180000,
    },
  ],
};

const revenueExportExample = {
  fileUrl: 'https://res.cloudinary.com/demo/raw/upload/v1234567890/picklehub/reports/revenue-transactions-2026-05-30.csv',
  publicId: 'picklehub/reports/revenue-transactions-2026-05-30',
  format: 'csv',
};

@ApiTags('Revenue')
@Controller('sport-centers/revenue')
@RequireSubscription('SPORT_CENTER_MANAGER')
export class RevenueController {
  constructor(private readonly paymentTransactions: PaymentTransactionService) {}

  @Get('summary')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get owner revenue summary',
    description: 'Returns settled revenue and outstanding payment queues across all owned centers, optionally filtered by centerId and date range.',
  })
  @ApiResponse({ status: 200, description: 'Revenue summary fetched successfully.', schema: { example: revenueSummaryExample } })
  @UseGuards(JwtAuthGuard)
  getRevenueSummary(@Req() req: any, @Query() query: RevenueQueryDto) {
    const ownerId = req.user?.userId;
    if (!ownerId) throw new UnauthorizedException();
    return this.paymentTransactions.getOwnerRevenueSummary(ownerId, query);
  }

  @Get('transactions')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List owner payment transactions',
    description: 'Lists payment transactions across all owned centers, optionally filtered by center, status, method, and date range.',
  })
  @ApiQuery({ name: 'centerId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'method', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({ status: 200, description: 'Payment transactions fetched successfully.', schema: { example: revenueTransactionsExample } })
  @UseGuards(JwtAuthGuard)
  getTransactions(@Req() req: any, @Query() query: RevenueQueryDto) {
    const ownerId = req.user?.userId;
    if (!ownerId) throw new UnauthorizedException();
    return this.paymentTransactions.listOwnerTransactions(ownerId, query);
  }

  @Get('statistics')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get owner revenue statistics',
    description:
      'Returns a read-only revenue dashboard that combines cash collections with gross court, service, and product revenue breakdowns across owned centers.',
  })
  @ApiQuery({ name: 'centerId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiResponse({ status: 200, description: 'Revenue statistics fetched successfully.', schema: { example: revenueStatisticsExample } })
  @UseGuards(JwtAuthGuard)
  getRevenueStatistics(@Req() req: any, @Query() query: RevenueStatisticsQueryDto) {
    const ownerId = req.user?.userId;
    if (!ownerId) throw new UnauthorizedException();
    return this.paymentTransactions.getOwnerRevenueStatistics(ownerId, query);
  }

  @Get('statistics/daily')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get owner revenue statistics grouped by day',
    description:
      'Returns a day-by-day read-only revenue dashboard including court, service, product, and cash collections for charting.',
  })
  @ApiQuery({ name: 'centerId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiResponse({ status: 200, description: 'Daily revenue statistics fetched successfully.', schema: { example: revenueDailyStatisticsExample } })
  @UseGuards(JwtAuthGuard)
  getRevenueDailyStatistics(@Req() req: any, @Query() query: RevenueStatisticsQueryDto) {
    const ownerId = req.user?.userId;
    if (!ownerId) throw new UnauthorizedException();
    return this.paymentTransactions.getOwnerRevenueDailyStatistics(ownerId, query);
  }

  @Get('cancellations')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get owner cancellation and refund analysis',
    description:
      'Returns cancelled booking totals, refunded credit totals, and a breakdown by center and cancellation reason.',
  })
  @ApiQuery({ name: 'centerId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiResponse({ status: 200, description: 'Cancellation analysis fetched successfully.', schema: { example: revenueCancellationExample } })
  @UseGuards(JwtAuthGuard)
  getRevenueCancellationAnalysis(@Req() req: any, @Query() query: RevenueStatisticsQueryDto) {
    const ownerId = req.user?.userId;
    if (!ownerId) throw new UnauthorizedException();
    return this.paymentTransactions.getOwnerCancellationAnalysis(ownerId, query);
  }

  @Post('export/csv')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Export owner payment transactions to CSV',
    description:
      'Generates a CSV file for the filtered payment transaction report, uploads it to the media service, and returns the downloadable Cloudinary URL.',
  })
  @ApiQuery({ name: 'centerId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'method', required: false })
  @ApiResponse({ status: 201, description: 'CSV export initiated successfully.', schema: { example: revenueExportExample } })
  @UseGuards(JwtAuthGuard)
  exportRevenueCsv(@Req() req: any, @Query() query: RevenueExportQueryDto) {
    const ownerId = req.user?.userId;
    if (!ownerId) throw new UnauthorizedException();
    return this.paymentTransactions.exportOwnerRevenueTransactionsCsv(ownerId, query);
  }
}
