import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

type PaymentTransactionStatus = 'PENDING_REVIEW' | 'SETTLED' | 'REJECTED' | 'VOIDED';
type PaymentMethod = 'BANK_TRANSFER' | 'CASH';

type PaymentSourceBooking = {
  id: string;
  centerId: string;
  playerId: string;
  paymentRemaining?: Prisma.Decimal | number | string | null;
  totalPrice?: Prisma.Decimal | number | string | null;
  paymentProofUrl?: string | null;
};

type RevenueFilter = {
  centerId?: string;
  from?: string;
  to?: string;
  status?: PaymentTransactionStatus;
  method?: PaymentMethod;
  limit?: number;
  offset?: number;
};

type RevenueStatisticsCenterRow = {
  centerId: string;
  centerName: string;
  courtRevenue: number;
  serviceRevenue: number;
  productRevenue: number;
  grossRevenue: number;
  bookingCount: number;
  serviceLineCount: number;
  productLineCount: number;
};

type RevenueDailyRow = {
  date: string;
  courtRevenue: number;
  serviceRevenue: number;
  productRevenue: number;
  grossRevenue: number;
  settledCashRevenue: number;
  pendingCashRevenue: number;
  bookingCount: number;
  settledTransactionCount: number;
  pendingTransactionCount: number;
};

type RevenueCancellationCenterRow = {
  centerId: string;
  centerName: string;
  cancelledBookingCount: number;
  cancelledRevenue: number;
  refundedCreditAmount: number;
};

type RevenueCancellationReasonRow = {
  cancelReason: string;
  cancelledBookingCount: number;
  cancelledRevenue: number;
  refundedCreditAmount: number;
};

@Injectable()
export class PaymentTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private database(client?: Prisma.TransactionClient | PrismaService) {
    return (client ?? this.prisma) as any;
  }

  private toAmount(value: Prisma.Decimal | number | string | null | undefined): number {
    return Number(value ?? 0);
  }

  private toLineTotal(price: Prisma.Decimal | number | string | null | undefined, quantity: number): number {
    return this.toAmount(price) * quantity;
  }

  private formatDateKey(value: Date | string | null | undefined): string {
    const date = value ? new Date(value) : new Date();
    return date.toISOString().split('T')[0];
  }

  private escapeCsv(value: string | number | Date | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    const text = value instanceof Date ? value.toISOString() : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  }

  private buildCsv(rows: Record<string, any>[], headers: string[]) {
    const headerLine = headers.join(',');
    const bodyLines = rows.map(row => headers.map(header => this.escapeCsv(row[header])).join(','));
    return [headerLine, ...bodyLines].join('\n');
  }

  private async uploadCsvToMediaService(fileName: string, csvContent: string) {
    const mediaServiceUrl = this.configService.get<string>('MEDIA_SERVICE_URL') || 'http://media-service:8011';
    const serviceToken = this.configService.get<string>('SERVICE_INTERNAL_TOKEN');

    if (!mediaServiceUrl || !serviceToken) {
      throw new BadRequestException('Media service is not configured for CSV export');
    }

    const formData = new FormData();
    formData.append('file', new Blob([csvContent], { type: 'text/csv;charset=utf-8' }), fileName);

    const uploadUrl = this.buildMediaServiceCsvUploadUrl(mediaServiceUrl);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'x-internal-service-token': serviceToken,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new BadRequestException(
        `Failed to upload CSV report to media service (${response.status}): ${errorText || response.statusText}`,
      );
    }

    return response.json() as Promise<{ url: string; publicId?: string; format?: string }>;
  }

  private buildMediaServiceCsvUploadUrl(serviceUrl: string) {
    const normalized = serviceUrl.replace(/\/$/, '');
    if (normalized.endsWith('/api/media')) {
      return `${normalized}/csv`;
    }

    return `${normalized}/api/media/csv`;
  }

  private toDateRange(from?: string, to?: string) {
    const range: { gte?: Date; lt?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setUTCDate(end.getUTCDate() + 1);
      range.lt = end;
    }
    return Object.keys(range).length > 0 ? range : undefined;
  }

  private async resolveOwnedCenterIds(ownerId: string, centerId?: string) {
    if (centerId) {
      const center = await this.prisma.sportCenter.findFirst({
        where: { id: centerId, ownerId },
        select: { id: true },
      });

      if (!center) {
        throw new NotFoundException('Sport center not found');
      }

      return [center.id];
    }

    const centers = await this.prisma.sportCenter.findMany({
      where: { ownerId },
      select: { id: true },
    });

    return centers.map(center => center.id);
  }

  private async upsertPaymentTransaction(
    tx: Prisma.TransactionClient | PrismaService,
    data: {
      booking: PaymentSourceBooking;
      amount: number;
      method: PaymentMethod;
      status: PaymentTransactionStatus;
      proofUrl?: string | null;
      receivedAt?: Date | null;
      reviewedAt?: Date | null;
      rejectedAt?: Date | null;
      rejectedReason?: string | null;
    },
  ) {
    const database = this.database(tx);

    return database.paymentTransaction.upsert({
      where: { bookingId: data.booking.id },
      create: {
        bookingId: data.booking.id,
        centerId: data.booking.centerId,
        playerId: data.booking.playerId,
        amount: data.amount,
        method: data.method,
        status: data.status,
        proofUrl: data.proofUrl ?? null,
        receivedAt: data.receivedAt ?? null,
        reviewedAt: data.reviewedAt ?? null,
        rejectedAt: data.rejectedAt ?? null,
        rejectedReason: data.rejectedReason ?? null,
      },
      update: {
        centerId: data.booking.centerId,
        playerId: data.booking.playerId,
        amount: data.amount,
        method: data.method,
        status: data.status,
        proofUrl: data.proofUrl ?? null,
        receivedAt: data.receivedAt ?? null,
        reviewedAt: data.reviewedAt ?? null,
        rejectedAt: data.rejectedAt ?? null,
        rejectedReason: data.rejectedReason ?? null,
      },
    });
  }

  async recordPendingBankTransfer(
    tx: Prisma.TransactionClient | PrismaService,
    booking: PaymentSourceBooking,
    proofUrl: string,
  ) {
    const amount = this.toAmount(booking.paymentRemaining);
    if (amount <= 0) {
      throw new BadRequestException('No outstanding payment is available for this booking');
    }

    return this.upsertPaymentTransaction(tx, {
      booking,
      amount,
      method: 'BANK_TRANSFER',
      status: 'PENDING_REVIEW',
      proofUrl,
    });
  }

  async settleBankTransfer(
    tx: Prisma.TransactionClient | PrismaService,
    booking: PaymentSourceBooking,
  ) {
    const amount = this.toAmount(booking.paymentRemaining);
    if (amount <= 0) {
      return null;
    }

    return this.upsertPaymentTransaction(tx, {
      booking,
      amount,
      method: 'BANK_TRANSFER',
      status: 'SETTLED',
      proofUrl: booking.paymentProofUrl ?? null,
      receivedAt: new Date(),
      reviewedAt: new Date(),
      rejectedAt: null,
      rejectedReason: null,
    });
  }

  async recordCashPayment(
    tx: Prisma.TransactionClient | PrismaService,
    booking: PaymentSourceBooking,
    amount: number,
  ) {
    if (amount <= 0) {
      return null;
    }

    return this.upsertPaymentTransaction(tx, {
      booking,
      amount,
      method: 'CASH',
      status: 'SETTLED',
      receivedAt: new Date(),
      reviewedAt: new Date(),
      rejectedAt: null,
      rejectedReason: null,
    });
  }

  async voidPendingPayment(
    tx: Prisma.TransactionClient | PrismaService,
    bookingId: string,
    reason: string,
  ) {
    const database = this.database(tx);

    return database.paymentTransaction.updateMany({
      where: {
        bookingId,
        status: 'PENDING_REVIEW',
      },
      data: {
        status: 'VOIDED',
        reviewedAt: new Date(),
        rejectedAt: new Date(),
        rejectedReason: reason,
      },
    });
  }

  async listOwnerTransactions(ownerId: string, filters: RevenueFilter) {
    const centerIds = await this.resolveOwnedCenterIds(ownerId, filters.centerId);
    if (centerIds.length === 0) {
      return { data: [], pagination: { limit: filters.limit ?? 20, offset: filters.offset ?? 0, total: 0 } };
    }

    const database = this.database();
    const where: any = {
      centerId: { in: centerIds },
    };

    if (filters.status) where.status = filters.status;
    if (filters.method) where.method = filters.method;
    const range = this.toDateRange(filters.from, filters.to);
    if (range) where.createdAt = range;

    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;

    const [data, total] = await database.$transaction([
      database.paymentTransaction.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          center: {
            select: { id: true, name: true },
          },
          booking: {
            select: {
              id: true,
              date: true,
              status: true,
              totalPrice: true,
              creditApplied: true,
              paymentRemaining: true,
              paymentProofUrl: true,
              paymentProofUploadedAt: true,
            },
          },
        },
      }),
      database.paymentTransaction.count({ where }),
    ]);

    return {
      data,
      pagination: { limit, offset, total },
    };
  }

  async getOwnerRevenueSummary(ownerId: string, filters: Pick<RevenueFilter, 'centerId' | 'from' | 'to'>) {
    const centerIds = await this.resolveOwnedCenterIds(ownerId, filters.centerId);
    if (centerIds.length === 0) {
      return {
        centerId: filters.centerId ?? null,
        period: { from: filters.from ?? null, to: filters.to ?? null },
        totalSettledRevenue: 0,
        totalPendingRevenue: 0,
        settledTransactionCount: 0,
        pendingTransactionCount: 0,
        byCenter: [],
      };
    }

    const database = this.database();
    const settledRange = this.toDateRange(filters.from, filters.to);

    const [centers, settledTransactions, pendingTransactions] = await Promise.all([
      database.sportCenter.findMany({
        where: { id: { in: centerIds } },
        select: { id: true, name: true },
      }),
      database.paymentTransaction.findMany({
        where: {
          centerId: { in: centerIds },
          status: 'SETTLED',
          ...(settledRange ? { receivedAt: settledRange } : {}),
        },
        select: {
          amount: true,
          centerId: true,
        },
      }),
      database.paymentTransaction.findMany({
        where: {
          centerId: { in: centerIds },
          status: 'PENDING_REVIEW',
        },
        select: {
          amount: true,
          centerId: true,
        },
      }),
    ]);

    const centerNameMap = new Map<string, string>(
      centers.map((center: any) => [String(center.id), String(center.name)]),
    );
    const aggregateMap = new Map<string, {
      centerId: string;
      centerName: string;
      settledRevenue: number;
      pendingRevenue: number;
      settledTransactionCount: number;
      pendingTransactionCount: number;
    }>();

    for (const centerId of centerIds) {
      aggregateMap.set(centerId, {
        centerId,
        centerName: centerNameMap.get(centerId) ?? 'Unknown center',
        settledRevenue: 0,
        pendingRevenue: 0,
        settledTransactionCount: 0,
        pendingTransactionCount: 0,
      });
    }

    for (const tx of settledTransactions) {
      const row = aggregateMap.get(tx.centerId);
      if (!row) continue;
      row.settledRevenue += this.toAmount(tx.amount);
      row.settledTransactionCount += 1;
    }

    for (const tx of pendingTransactions) {
      const row = aggregateMap.get(tx.centerId);
      if (!row) continue;
      row.pendingRevenue += this.toAmount(tx.amount);
      row.pendingTransactionCount += 1;
    }

    const byCenter = Array.from(aggregateMap.values()).sort((a, b) => a.centerName.localeCompare(b.centerName));

    return {
      centerId: filters.centerId ?? null,
      period: { from: filters.from ?? null, to: filters.to ?? null },
      totalSettledRevenue: settledTransactions.reduce((sum: number, tx: any) => sum + this.toAmount(tx.amount), 0),
      totalPendingRevenue: pendingTransactions.reduce((sum: number, tx: any) => sum + this.toAmount(tx.amount), 0),
      settledTransactionCount: settledTransactions.length,
      pendingTransactionCount: pendingTransactions.length,
      byCenter,
    };
  }

  async getOwnerRevenueStatistics(ownerId: string, filters: Pick<RevenueFilter, 'centerId' | 'from' | 'to'>) {
    const centerIds = await this.resolveOwnedCenterIds(ownerId, filters.centerId);
    if (centerIds.length === 0) {
      return {
        centerId: filters.centerId ?? null,
        period: { from: filters.from ?? null, to: filters.to ?? null },
        cashRevenue: {
          totalSettledRevenue: 0,
          totalPendingRevenue: 0,
          settledTransactionCount: 0,
          pendingTransactionCount: 0,
          byCenter: [],
        },
        grossRevenue: {
          totalCourtRevenue: 0,
          totalServiceRevenue: 0,
          totalProductRevenue: 0,
          totalRevenue: 0,
          bookingCount: 0,
          serviceLineCount: 0,
          productLineCount: 0,
          byCenter: [],
        },
      };
    }

    const database = this.database();
    const bookingRange = this.toDateRange(filters.from, filters.to);

    const [cashRevenue, centers, bookings] = await Promise.all([
      this.getOwnerRevenueSummary(ownerId, filters),
      database.sportCenter.findMany({
        where: { id: { in: centerIds } },
        select: { id: true, name: true },
      }),
      database.booking.findMany({
        where: {
          centerId: { in: centerIds },
          status: { not: 'CANCELLED' },
          ...(bookingRange ? { createdAt: bookingRange } : {}),
        },
        select: {
          centerId: true,
          bookingItems: {
            select: {
              itemPrice: true,
            },
          },
          bookingServices: {
            select: {
              price: true,
              quantity: true,
            },
          },
          bookingProducts: {
            select: {
              price: true,
              quantity: true,
            },
          },
        },
      }),
    ]);

    const centerNameMap = new Map<string, string>(
      centers.map((center: any) => [String(center.id), String(center.name)]),
    );

    const aggregateMap = new Map<string, RevenueStatisticsCenterRow>();
    for (const centerId of centerIds) {
      aggregateMap.set(centerId, {
        centerId,
        centerName: centerNameMap.get(centerId) ?? 'Unknown center',
        courtRevenue: 0,
        serviceRevenue: 0,
        productRevenue: 0,
        grossRevenue: 0,
        bookingCount: 0,
        serviceLineCount: 0,
        productLineCount: 0,
      });
    }

    for (const booking of bookings) {
      const row = aggregateMap.get(booking.centerId);
      if (!row) continue;

      const courtRevenue = booking.bookingItems.reduce(
        (sum: number, item: any) => sum + this.toAmount(item.itemPrice),
        0,
      );
      const serviceRevenue = booking.bookingServices.reduce(
        (sum: number, service: any) => sum + this.toLineTotal(service.price, service.quantity),
        0,
      );
      const productRevenue = booking.bookingProducts.reduce(
        (sum: number, product: any) => sum + this.toLineTotal(product.price, product.quantity),
        0,
      );

      row.courtRevenue += courtRevenue;
      row.serviceRevenue += serviceRevenue;
      row.productRevenue += productRevenue;
      row.grossRevenue += courtRevenue + serviceRevenue + productRevenue;
      row.bookingCount += 1;
      row.serviceLineCount += booking.bookingServices.length;
      row.productLineCount += booking.bookingProducts.length;
    }

    const grossByCenter = Array.from(aggregateMap.values()).sort((a, b) => a.centerName.localeCompare(b.centerName));

    return {
      centerId: filters.centerId ?? null,
      period: { from: filters.from ?? null, to: filters.to ?? null },
      cashRevenue,
      grossRevenue: {
        totalCourtRevenue: grossByCenter.reduce((sum, row) => sum + row.courtRevenue, 0),
        totalServiceRevenue: grossByCenter.reduce((sum, row) => sum + row.serviceRevenue, 0),
        totalProductRevenue: grossByCenter.reduce((sum, row) => sum + row.productRevenue, 0),
        totalRevenue: grossByCenter.reduce((sum, row) => sum + row.grossRevenue, 0),
        bookingCount: grossByCenter.reduce((sum, row) => sum + row.bookingCount, 0),
        serviceLineCount: grossByCenter.reduce((sum, row) => sum + row.serviceLineCount, 0),
        productLineCount: grossByCenter.reduce((sum, row) => sum + row.productLineCount, 0),
        byCenter: grossByCenter,
      },
    };
  }

  async getOwnerRevenueDailyStatistics(ownerId: string, filters: Pick<RevenueFilter, 'centerId' | 'from' | 'to'>) {
    const centerIds = await this.resolveOwnedCenterIds(ownerId, filters.centerId);
    if (centerIds.length === 0) {
      return {
        centerId: filters.centerId ?? null,
        period: { from: filters.from ?? null, to: filters.to ?? null },
        byDay: [],
      };
    }

    const database = this.database();
    const bookingRange = this.toDateRange(filters.from, filters.to);

    const [bookings, settledTransactions, pendingTransactions] = await Promise.all([
      database.booking.findMany({
        where: {
          centerId: { in: centerIds },
          status: { not: 'CANCELLED' },
          ...(bookingRange ? { createdAt: bookingRange } : {}),
        },
        select: {
          centerId: true,
          createdAt: true,
          bookingItems: {
            select: { itemPrice: true },
          },
          bookingServices: {
            select: { price: true, quantity: true },
          },
          bookingProducts: {
            select: { price: true, quantity: true },
          },
        },
      }),
      database.paymentTransaction.findMany({
        where: {
          centerId: { in: centerIds },
          status: 'SETTLED',
          ...(bookingRange ? { receivedAt: bookingRange } : {}),
        },
        select: {
          amount: true,
          createdAt: true,
          receivedAt: true,
        },
      }),
      database.paymentTransaction.findMany({
        where: {
          centerId: { in: centerIds },
          status: 'PENDING_REVIEW',
          ...(bookingRange ? { createdAt: bookingRange } : {}),
        },
        select: {
          amount: true,
          createdAt: true,
        },
      }),
    ]);

    const dayMap = new Map<string, RevenueDailyRow>();

    const getDayRow = (date: string) => {
      const existing = dayMap.get(date);
      if (existing) return existing;

      const row: RevenueDailyRow = {
        date,
        courtRevenue: 0,
        serviceRevenue: 0,
        productRevenue: 0,
        grossRevenue: 0,
        settledCashRevenue: 0,
        pendingCashRevenue: 0,
        bookingCount: 0,
        settledTransactionCount: 0,
        pendingTransactionCount: 0,
      };
      dayMap.set(date, row);
      return row;
    };

    for (const booking of bookings) {
      const dateKey = this.formatDateKey(booking.createdAt);
      const row = getDayRow(dateKey);
      const courtRevenue = booking.bookingItems.reduce((sum: number, item: any) => sum + this.toAmount(item.itemPrice), 0);
      const serviceRevenue = booking.bookingServices.reduce((sum: number, service: any) => sum + this.toLineTotal(service.price, service.quantity), 0);
      const productRevenue = booking.bookingProducts.reduce((sum: number, product: any) => sum + this.toLineTotal(product.price, product.quantity), 0);

      row.courtRevenue += courtRevenue;
      row.serviceRevenue += serviceRevenue;
      row.productRevenue += productRevenue;
      row.grossRevenue += courtRevenue + serviceRevenue + productRevenue;
      row.bookingCount += 1;
    }

    for (const tx of settledTransactions) {
      const dateKey = this.formatDateKey(tx.receivedAt ?? tx.createdAt);
      const row = getDayRow(dateKey);
      row.settledCashRevenue += this.toAmount(tx.amount);
      row.settledTransactionCount += 1;
    }

    for (const tx of pendingTransactions) {
      const dateKey = this.formatDateKey(tx.createdAt);
      const row = getDayRow(dateKey);
      row.pendingCashRevenue += this.toAmount(tx.amount);
      row.pendingTransactionCount += 1;
    }

    return {
      centerId: filters.centerId ?? null,
      period: { from: filters.from ?? null, to: filters.to ?? null },
      byDay: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async getOwnerCancellationAnalysis(ownerId: string, filters: Pick<RevenueFilter, 'centerId' | 'from' | 'to'>) {
    const centerIds = await this.resolveOwnedCenterIds(ownerId, filters.centerId);
    if (centerIds.length === 0) {
      return {
        centerId: filters.centerId ?? null,
        period: { from: filters.from ?? null, to: filters.to ?? null },
        totalCancelledBookingCount: 0,
        totalCancelledRevenue: 0,
        totalRefundedCreditAmount: 0,
        byCenter: [],
        byReason: [],
      };
    }

    const database = this.database();
    const range = this.toDateRange(filters.from, filters.to);

    const [centers, cancelledBookings, refundTransactions] = await Promise.all([
      database.sportCenter.findMany({
        where: { id: { in: centerIds } },
        select: { id: true, name: true },
      }),
      database.booking.findMany({
        where: {
          centerId: { in: centerIds },
          status: 'CANCELLED',
          ...(range ? { cancelledAt: range } : {}),
        },
        select: {
          centerId: true,
          cancelReason: true,
          totalPrice: true,
          creditApplied: true,
          paymentRemaining: true,
        },
      }),
      database.creditTransaction.findMany({
        where: {
          type: 'CANCELLATION_REFUND',
          ...(range ? { createdAt: range } : {}),
          credit: {
            centerId: { in: centerIds },
          },
        },
        select: {
          amount: true,
          credit: {
            select: { centerId: true },
          },
        },
      }),
    ]);

    const centerNameMap = new Map<string, string>(
      centers.map((center: any) => [String(center.id), String(center.name)]),
    );

    const centerMap = new Map<string, RevenueCancellationCenterRow>();
    const reasonMap = new Map<string, RevenueCancellationReasonRow>();

    for (const centerId of centerIds) {
      centerMap.set(centerId, {
        centerId,
        centerName: centerNameMap.get(centerId) ?? 'Unknown center',
        cancelledBookingCount: 0,
        cancelledRevenue: 0,
        refundedCreditAmount: 0,
      });
    }

    for (const booking of cancelledBookings) {
      const centerRow = centerMap.get(booking.centerId);
      if (!centerRow) continue;

      const cancelledRevenue = this.toAmount(booking.totalPrice);
      const reason = booking.cancelReason || 'UNSPECIFIED';

      centerRow.cancelledBookingCount += 1;
      centerRow.cancelledRevenue += cancelledRevenue;

      const reasonRow = reasonMap.get(reason) ?? {
        cancelReason: reason,
        cancelledBookingCount: 0,
        cancelledRevenue: 0,
        refundedCreditAmount: 0,
      };
      reasonRow.cancelledBookingCount += 1;
      reasonRow.cancelledRevenue += cancelledRevenue;
      reasonRow.refundedCreditAmount += this.toAmount(booking.creditApplied);
      reasonMap.set(reason, reasonRow);
    }

    for (const refund of refundTransactions) {
      const centerRow = centerMap.get(refund.credit.centerId);
      if (!centerRow) continue;
      centerRow.refundedCreditAmount += this.toAmount(refund.amount);
    }

    return {
      centerId: filters.centerId ?? null,
      period: { from: filters.from ?? null, to: filters.to ?? null },
      totalCancelledBookingCount: cancelledBookings.length,
      totalCancelledRevenue: (() => {
        let total = 0;
        for (const booking of cancelledBookings) {
          total += this.toAmount(booking.totalPrice);
        }
        return total;
      })(),
      totalRefundedCreditAmount: (() => {
        let total = 0;
        for (const refund of refundTransactions) {
          total += this.toAmount(refund.amount);
        }
        return total;
      })(),
      byCenter: Array.from(centerMap.values()).sort((a, b) => a.centerName.localeCompare(b.centerName)),
      byReason: Array.from(reasonMap.values()).sort((a, b) => b.cancelledBookingCount - a.cancelledBookingCount),
    };
  }

  async exportOwnerRevenueTransactionsCsv(ownerId: string, filters: RevenueFilter) {
    const centerIds = await this.resolveOwnedCenterIds(ownerId, filters.centerId);
    if (centerIds.length === 0) {
      const csv = this.buildCsv([], [
        'transactionId',
        'bookingId',
        'centerId',
        'centerName',
        'playerId',
        'amount',
        'method',
        'status',
        'proofUrl',
        'receivedAt',
        'reviewedAt',
        'rejectedAt',
        'rejectedReason',
        'createdAt',
      ]);

      const vnDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
      return this.uploadCsvToMediaService(
        `revenue-transactions-${vnDate}.csv`,
        csv,
      );
    }

    const database = this.database();
    const where: any = {
      centerId: { in: centerIds },
    };

    if (filters.status) where.status = filters.status;
    if (filters.method) where.method = filters.method;
    const range = this.toDateRange(filters.from, filters.to);
    if (range) where.createdAt = range;

    const transactions = await database.paymentTransaction.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        center: {
          select: { id: true, name: true },
        },
      },
    });

    const csv = this.buildCsv(
      transactions.map((transaction: any) => ({
        transactionId: transaction.id,
        bookingId: transaction.bookingId,
        centerId: transaction.centerId,
        centerName: transaction.center?.name ?? '',
        playerId: transaction.playerId,
        amount: Number(transaction.amount),
        method: transaction.method,
        status: transaction.status,
        proofUrl: transaction.proofUrl ?? '',
        receivedAt: transaction.receivedAt ?? '',
        reviewedAt: transaction.reviewedAt ?? '',
        rejectedAt: transaction.rejectedAt ?? '',
        rejectedReason: transaction.rejectedReason ?? '',
        createdAt: transaction.createdAt,
      })),
      [
        'transactionId',
        'bookingId',
        'centerId',
        'centerName',
        'playerId',
        'amount',
        'method',
        'status',
        'proofUrl',
        'receivedAt',
        'reviewedAt',
        'rejectedAt',
        'rejectedReason',
        'createdAt',
      ],
    );

    const vnDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const uploaded = await this.uploadCsvToMediaService(
      `revenue-transactions-${vnDate}.csv`,
      csv,
    );

    return {
      fileUrl: uploaded.url,
      publicId: uploaded.publicId ?? null,
      format: uploaded.format ?? 'csv',
    };
  }
}