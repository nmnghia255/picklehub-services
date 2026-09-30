import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnerDashboardOverview(ownerId: string) {
    const centers = await this.prisma.sportCenter.findMany({
      where: { ownerId, deletedAt: null },
      select: { id: true }
    });

    const centerIds = centers.map((c) => c.id);

    if (centerIds.length === 0) {
      return this.getEmptyStats();
    }

    const stats = await this.calculateDashboardStats(centerIds);
    return {
      ...stats,
      facility: {
        totalCenters: centers.length,
        totalCourts: stats.facility.totalCourts,
      }
    };
  }

  async getCenterDashboardOverview(ownerId: string, centerId: string) {
    const center = await this.prisma.sportCenter.findUnique({
      where: { id: centerId, deletedAt: null },
      select: { ownerId: true }
    });

    if (!center) {
      throw new NotFoundException('Sport center not found');
    }

    if (center.ownerId !== ownerId) {
      throw new UnauthorizedException('You do not own this sport center');
    }

    const stats = await this.calculateDashboardStats([centerId]);
    return {
      ...stats,
      facility: {
        totalCenters: 1,
        totalCourts: stats.facility.totalCourts,
      }
    };
  }

  private getEmptyStats() {
    return {
      facility: { totalCenters: 0, totalCourts: 0 },
      customers: { totalUniqueCustomers: 0, globalAverageRating: 0, totalReviews: 0 },
      bookings: { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
      revenue: { settled: 0, pending: 0 }
    };
  }

  private async calculateDashboardStats(centerIds: string[]) {
    // 2. Aggregate Courts
    const totalCourts = await this.prisma.court.count({
      where: { centerId: { in: centerIds }, status: 'ACTIVE' }
    });

    // 3. Aggregate Bookings (Group by status)
    const bookingsGroup = await this.prisma.booking.groupBy({
      by: ['status'],
      where: { centerId: { in: centerIds } },
      _count: true,
    });

    let totalBookings = 0;
    const bookingStats = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
    bookingsGroup.forEach(group => {
      totalBookings += group._count;
      switch (group.status) {
        case 'PENDING': bookingStats.pending = group._count; break;
        case 'CONFIRMED': bookingStats.confirmed = group._count; break;
        case 'COMPLETED': bookingStats.completed = group._count; break;
        case 'CANCELLED': bookingStats.cancelled = group._count; break;
      }
    });

    // 4. Aggregate Unique Customers
    const uniqueCustomersQuery = await this.prisma.booking.findMany({
      where: { centerId: { in: centerIds } },
      distinct: ['playerId'],
      select: { playerId: true }
    });
    const totalUniqueCustomers = uniqueCustomersQuery.length;

    // 5. Aggregate Reviews
    const reviewStats = await this.prisma.review.aggregate({
      where: { centerId: { in: centerIds } },
      _count: true,
      _avg: { rating: true }
    });
    const totalReviews = reviewStats._count;
    const globalAverageRating = reviewStats._avg.rating ? Number(reviewStats._avg.rating.toFixed(1)) : 0;

    // 6. Aggregate Revenue
    const revenueStats = await this.prisma.paymentTransaction.groupBy({
      by: ['status'],
      where: { centerId: { in: centerIds } },
      _sum: { amount: true },
    });
    let settledRevenue = 0;
    let pendingRevenue = 0;
    revenueStats.forEach(stat => {
      if (stat.status === 'SETTLED' && stat._sum.amount) {
        settledRevenue = Number(stat._sum.amount);
      } else if (stat.status === 'PENDING_REVIEW' && stat._sum.amount) {
        pendingRevenue = Number(stat._sum.amount);
      }
    });

    return {
      facility: {
        totalCenters: centerIds.length,
        totalCourts,
      },
      customers: {
        totalUniqueCustomers,
        globalAverageRating,
        totalReviews,
      },
      bookings: {
        total: totalBookings,
        pending: bookingStats.pending,
        confirmed: bookingStats.confirmed,
        completed: bookingStats.completed,
        cancelled: bookingStats.cancelled,
      },
      revenue: {
        settled: settledRevenue,
        pending: pendingRevenue,
      }
    };
  }
}
