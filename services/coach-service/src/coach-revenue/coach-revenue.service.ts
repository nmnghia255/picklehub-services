import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthIntegrationService } from '../auth-integration/auth-integration.service';
import { PrismaService } from '../prisma.service';
import { CoachRevenueRangeQueryDto } from './dto/coach-revenue-range-query.dto';
import { CoachRevenueSummaryQueryDto } from './dto/coach-revenue-summary-query.dto';

type RevenueSummaryPeriod = 'month' | 'quarter' | 'year';

type RevenueSummaryBucket = {
  key: string;
  label: string;
  classRevenueVnd: number;
  bookingRevenueVnd: number;
  totalRevenueVnd: number;
  classSettlementCount: number;
  bookingSettlementCount: number;
  totalSettlementCount: number;
  courtCostVnd: number;
  netRevenueVnd: number;
};

type RevenueClassRow = {
  classId: string;
  title: string;
  status: string;
  level: string | null;
  locationDescription: string | null;
  coverImageUrl: string | null;
  enrolledLearnerCount: number;
  settledEnrollmentCount: number;
  settledRevenueVnd: number;
  firstSettledAt: Date | null;
  lastSettledAt: Date | null;
};

type RevenueBookingRow = {
  bookingId: string;
  coachProfileId: string;
  learnerId: string;
  learnerProfile: any | null;
  sessionAt: Date;
  durationMinutes: number;
  status: string;
  paymentStatus: string | null;
  priceVnd: number;
  courtCostVnd: number | null;
  netRevenueVnd: number;
  settledAt: Date | null;
  coachNote: string | null;
  cancelReason: string | null;
};

@Injectable()
export class CoachRevenueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authIntegration: AuthIntegrationService,
  ) {}

  private async resolveCoachProfileId(userId: string): Promise<string> {
    const profile = await this.prisma.coachProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Coach profile not found. Please register as a coach first.');
    }
    return profile.id;
  }

  private monthLabel(year: number, month: number) {
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  private quarterLabel(year: number, quarter: number) {
    return `Q${quarter} ${year}`;
  }

  private buildSummaryBuckets(year: number, period: RevenueSummaryPeriod): RevenueSummaryBucket[] {
    if (period === 'year') {
      return [
        {
          key: `${year}`,
          label: `${year}`,
          classRevenueVnd: 0,
          bookingRevenueVnd: 0,
          totalRevenueVnd: 0,
          classSettlementCount: 0,
          bookingSettlementCount: 0,
          totalSettlementCount: 0,
          courtCostVnd: 0,
          netRevenueVnd: 0,
        },
      ];
    }

    if (period === 'quarter') {
      return Array.from({ length: 4 }, (_, index) => ({
        key: `${year}-Q${index + 1}`,
        label: this.quarterLabel(year, index + 1),
        classRevenueVnd: 0,
        bookingRevenueVnd: 0,
        totalRevenueVnd: 0,
        classSettlementCount: 0,
        bookingSettlementCount: 0,
        totalSettlementCount: 0,
        courtCostVnd: 0,
        netRevenueVnd: 0,
      }));
    }

    return Array.from({ length: 12 }, (_, index) => ({
      key: `${year}-${String(index + 1).padStart(2, '0')}`,
      label: this.monthLabel(year, index + 1),
      classRevenueVnd: 0,
      bookingRevenueVnd: 0,
      totalRevenueVnd: 0,
      classSettlementCount: 0,
      bookingSettlementCount: 0,
      totalSettlementCount: 0,
      courtCostVnd: 0,
      netRevenueVnd: 0,
    }));
  }

  private summaryBucketIndex(date: Date, period: RevenueSummaryPeriod) {
    if (period === 'year') return 0;
    if (period === 'quarter') return Math.floor(date.getUTCMonth() / 3);
    return date.getUTCMonth();
  }

  private normalizeRange(query: CoachRevenueRangeQueryDto) {
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;
    return { from, to };
  }

  private monthIndex(date: Date) {
    return date.getUTCMonth();
  }

  private inRange(date: Date, from: Date | null, to: Date | null) {
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  async getSummary(userId: string, query: CoachRevenueSummaryQueryDto) {
    const coachProfileId = await this.resolveCoachProfileId(userId);
    const year = query.year ?? new Date().getUTCFullYear();
    const period = query.period ?? 'month';
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const summaryBuckets = this.buildSummaryBuckets(year, period);

    const [classEnrollments, privateBookings] = await Promise.all([
      this.prisma.classEnrollment.findMany({
        where: {
          paymentStatus: 'SETTLED',
          settledAt: { gte: start, lt: end },
          coachClass: { coachProfileId },
        },
        select: {
          amountVnd: true,
          settledAt: true,
        },
      }),
      this.prisma.privateBooking.findMany({
        where: {
          paymentStatus: 'SETTLED',
          settledAt: { gte: start, lt: end },
          coachProfileId,
        },
        select: {
          priceVnd: true,
          courtCostVnd: true,
          settledAt: true,
        },
      }),
    ]);

    for (const enrollment of classEnrollments) {
      if (!enrollment.settledAt) continue;
      const bucket = summaryBuckets[this.summaryBucketIndex(enrollment.settledAt, period)];
      bucket.classRevenueVnd += enrollment.amountVnd;
      bucket.classSettlementCount += 1;
      bucket.totalRevenueVnd += enrollment.amountVnd;
      bucket.totalSettlementCount += 1;
    }

    for (const booking of privateBookings) {
      if (!booking.settledAt) continue;
      const bucket = summaryBuckets[this.summaryBucketIndex(booking.settledAt, period)];
      const cost = booking.courtCostVnd ?? 0;
      bucket.bookingRevenueVnd += booking.priceVnd;
      bucket.bookingSettlementCount += 1;
      bucket.totalRevenueVnd += booking.priceVnd;
      bucket.totalSettlementCount += 1;
      bucket.courtCostVnd += cost;
      bucket.netRevenueVnd += booking.priceVnd - cost;
    }

    const classRevenueVnd = classEnrollments.reduce((sum, item) => sum + item.amountVnd, 0);
    const bookingRevenueVnd = privateBookings.reduce((sum, item) => sum + item.priceVnd, 0);
    const totalCourtCostVnd = privateBookings.reduce((sum, item) => sum + (item.courtCostVnd ?? 0), 0);

    return {
      year,
      period,
      totals: {
        classRevenueVnd,
        bookingRevenueVnd,
        totalRevenueVnd: classRevenueVnd + bookingRevenueVnd,
        classSettlementCount: classEnrollments.length,
        bookingSettlementCount: privateBookings.length,
        totalSettlementCount: classEnrollments.length + privateBookings.length,
        courtCostVnd: totalCourtCostVnd,
        netRevenueVnd: classRevenueVnd + bookingRevenueVnd - totalCourtCostVnd,
      },
      buckets: summaryBuckets,
    };
  }

  async listClassRevenue(userId: string, query: CoachRevenueRangeQueryDto) {
    const coachProfileId = await this.resolveCoachProfileId(userId);
    const { from, to } = this.normalizeRange(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const classes = await this.prisma.coachClass.findMany({
      where: { coachProfileId },
      select: {
        id: true,
        title: true,
        status: true,
        level: true,
        locationDescription: true,
        coverImageUrl: true,
        enrollments: {
          where: {
            paymentStatus: 'SETTLED',
            ...(from || to
              ? {
                  settledAt: {
                    ...(from ? { gte: from } : {}),
                    ...(to ? { lte: to } : {}),
                  },
                }
              : {}),
          },
          select: { amountVnd: true, settledAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = classes.map<RevenueClassRow>((cls) => {
      const settledEnrollmentCount = cls.enrollments.length;
      const settledRevenueVnd = cls.enrollments.reduce((sum, enrollment) => sum + enrollment.amountVnd, 0);
      const settledAtValues = cls.enrollments
        .map((enrollment) => enrollment.settledAt)
        .filter((date): date is Date => Boolean(date));

      return {
        classId: cls.id,
        title: cls.title,
        status: cls.status,
        level: cls.level,
        locationDescription: cls.locationDescription,
        coverImageUrl: cls.coverImageUrl,
        enrolledLearnerCount: settledEnrollmentCount,
        settledEnrollmentCount,
        settledRevenueVnd,
        firstSettledAt: settledAtValues.length > 0 ? new Date(Math.min(...settledAtValues.map((date) => date.getTime()))) : null,
        lastSettledAt: settledAtValues.length > 0 ? new Date(Math.max(...settledAtValues.map((date) => date.getTime()))) : null,
      };
    }).filter((row) => row.settledEnrollmentCount > 0);

    const total = rows.length;

    return {
      data: rows.slice(skip, skip + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      totals: {
        settledEnrollmentCount: rows.reduce((sum, row) => sum + row.settledEnrollmentCount, 0),
        settledRevenueVnd: rows.reduce((sum, row) => sum + row.settledRevenueVnd, 0),
      },
    };
  }

  async listBookingRevenue(userId: string, query: CoachRevenueRangeQueryDto) {
    const coachProfileId = await this.resolveCoachProfileId(userId);
    const { from, to } = this.normalizeRange(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const bookings = await this.prisma.privateBooking.findMany({
      where: {
        coachProfileId,
        paymentStatus: 'SETTLED',
        ...(from || to
          ? {
              settledAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { settledAt: 'desc' },
      include: {
        coachProfile: {
          select: {
            id: true,
            displayName: true,
            paymentAccountName: true,
            paymentAccountNumber: true,
            paymentBankName: true,
            paymentQrUrl: true,
          },
        },
      },
    });

    const learnerProfiles = await this.authIntegration.getUsersProfiles(
      bookings.map((booking) => booking.learnerId),
    );

    const rows = bookings.map<RevenueBookingRow>((booking) => ({
      bookingId: booking.id,
      coachProfileId: booking.coachProfileId,
      learnerId: booking.learnerId,
      learnerProfile: learnerProfiles.get(booking.learnerId) || null,
      sessionAt: booking.sessionAt,
      durationMinutes: booking.durationMinutes,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      priceVnd: booking.priceVnd,
      courtCostVnd: booking.courtCostVnd ?? null,
      netRevenueVnd: booking.priceVnd - (booking.courtCostVnd ?? 0),
      settledAt: booking.settledAt,
      coachNote: booking.coachNote,
      cancelReason: booking.cancelReason,
    }));

    const total = rows.length;

    return {
      data: rows.slice(skip, skip + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      totals: {
        settledBookingCount: rows.length,
        settledRevenueVnd: rows.reduce((sum, row) => sum + row.priceVnd, 0),
      },
    };
  }
}