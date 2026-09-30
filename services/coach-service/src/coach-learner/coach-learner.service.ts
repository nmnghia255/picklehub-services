import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthIntegrationService } from '../auth-integration/auth-integration.service';
import { PrismaService } from '../prisma.service';
import { ListCoachLearnersQueryDto } from './dto/list-coach-learners-query.dto';

type LearnerRecordKind = 'class' | 'booking';

type CoachLearnerUpcomingSession = {
  type: 'class' | 'booking';
  id: string;
  title: string;
  startsAt: Date;
  status: string;
  paymentStatus: string | null;
  classId?: string;
  bookingId?: string;
  classTitle?: string;
};

type CoachLearnerSummary = {
  learnerId: string;
  learnerProfile: any;
  latestActivityAt: Date | null;
  classEnrollmentCount: number;
  activeClassEnrollmentCount: number;
  cancelledClassEnrollmentCount: number;
  classPaymentPendingReviewCount: number;
  classPaymentSettledCount: number;
  classPaymentRejectedCount: number;
  privateBookingCount: number;
  pendingBookingCount: number;
  confirmedBookingCount: number;
  completedBookingCount: number;
  cancelledBookingCount: number;
  rejectedBookingCount: number;
  bookingPaymentPendingReviewCount: number;
  bookingPaymentSettledCount: number;
  bookingPaymentRejectedCount: number;
};

type CoachLearnerDetail = CoachLearnerSummary & {
  classEnrollments: any[];
  privateBookings: any[];
};

@Injectable()
export class CoachLearnerService {
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

  private async getCoachClassIds(coachProfileId: string): Promise<string[]> {
    const classes = await this.prisma.coachClass.findMany({
      where: { coachProfileId },
      select: { id: true },
    });
    return classes.map((item) => item.id);
  }

  private maxDate(...dates: Array<Date | null | undefined>): Date | null {
    const validDates = dates.filter((date): date is Date => Boolean(date));
    if (validDates.length === 0) return null;
    return new Date(Math.max(...validDates.map((date) => date.getTime())));
  }

  private buildSummaryBuckets() {
    return {
      latestActivityAt: null as Date | null,
      classEnrollmentCount: 0,
      activeClassEnrollmentCount: 0,
      cancelledClassEnrollmentCount: 0,
      classPaymentPendingReviewCount: 0,
      classPaymentSettledCount: 0,
      classPaymentRejectedCount: 0,
      privateBookingCount: 0,
      pendingBookingCount: 0,
      confirmedBookingCount: 0,
      completedBookingCount: 0,
      cancelledBookingCount: 0,
      rejectedBookingCount: 0,
      bookingPaymentPendingReviewCount: 0,
      bookingPaymentSettledCount: 0,
      bookingPaymentRejectedCount: 0,
    };
  }

  private getLearnerBucket(map: Map<string, CoachLearnerDetail>, learnerId: string) {
    let bucket = map.get(learnerId);
    if (!bucket) {
      bucket = {
        learnerId,
        learnerProfile: null,
        ...this.buildSummaryBuckets(),
        classEnrollments: [],
        privateBookings: [],
      };
      map.set(learnerId, bucket);
    }
    return bucket;
  }

  private extractLatestActivityFromClassEnrollment(enrollment: {
    enrolledAt: Date;
    proofUploadedAt: Date | null;
    settledAt: Date | null;
    cancelledAt: Date | null;
  }) {
    return this.maxDate(enrollment.enrolledAt, enrollment.proofUploadedAt, enrollment.settledAt, enrollment.cancelledAt);
  }

  private extractLatestActivityFromBooking(booking: {
    createdAt: Date;
    updatedAt: Date;
    proofUploadedAt: Date | null;
    settledAt: Date | null;
    completedAt: Date | null;
  }) {
    return this.maxDate(booking.createdAt, booking.updatedAt, booking.proofUploadedAt, booking.settledAt, booking.completedAt);
  }

  private async fetchLearnerData(coachProfileId: string, learnerId?: string, kind: 'all' | LearnerRecordKind = 'all') {
    const classIds = await this.getCoachClassIds(coachProfileId);

    const classEnrollmentPromise = kind !== 'booking' && classIds.length > 0
      ? this.prisma.classEnrollment.findMany({
          where: {
            classId: { in: classIds },
            ...(learnerId ? { learnerId } : {}),
          },
          orderBy: { enrolledAt: 'desc' },
          include: {
            coachClass: {
              select: {
                id: true,
                title: true,
                level: true,
                status: true,
                locationDescription: true,
                priceVnd: true,
                coverImageUrl: true,
              },
            },
          },
        })
      : Promise.resolve([]);

    const privateBookingPromise = kind !== 'class'
      ? this.prisma.privateBooking.findMany({
          where: {
            coachProfileId,
            ...(learnerId ? { learnerId } : {}),
          },
          orderBy: { sessionAt: 'asc' },
        })
      : Promise.resolve([]);

    const [classEnrollments, privateBookings] = await Promise.all([
      classEnrollmentPromise,
      privateBookingPromise,
    ]);

    return { classEnrollments, privateBookings };
  }

  private hasLearnerRelationship(classEnrollments: any[], privateBookings: any[]) {
    return classEnrollments.length > 0 || privateBookings.length > 0;
  }

  private async fetchUpcomingSessions(coachProfileId: string, learnerId: string): Promise<CoachLearnerUpcomingSession[]> {
    const now = new Date();

    const [classEnrollments, privateBookings] = await Promise.all([
      this.prisma.classEnrollment.findMany({
        where: {
          learnerId,
          status: 'ACTIVE',
          coachClass: { coachProfileId },
        },
        select: {
          classId: true,
          coachClass: {
            select: {
              title: true,
              schedules: {
                where: { scheduledAt: { gte: now } },
                orderBy: { scheduledAt: 'asc' },
                select: { id: true, scheduledAt: true },
              },
            },
          },
        },
      }),
      this.prisma.privateBooking.findMany({
        where: {
          coachProfileId,
          learnerId,
          status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED'] },
          sessionAt: { gte: now },
        },
        select: {
          id: true,
          sessionAt: true,
          durationMinutes: true,
          status: true,
          paymentStatus: true,
        },
        orderBy: { sessionAt: 'asc' },
      }),
    ]);

    const classSessions = classEnrollments.flatMap((enrollment) =>
      enrollment.coachClass.schedules.map((schedule) => ({
        type: 'class' as const,
        id: schedule.id,
        title: enrollment.coachClass.title,
        startsAt: schedule.scheduledAt,
        status: 'ACTIVE',
        paymentStatus: null,
        classId: enrollment.classId,
        classTitle: enrollment.coachClass.title,
      })),
    );

    const bookingSessions = privateBookings.map((booking) => ({
      type: 'booking' as const,
      id: booking.id,
      title: 'Private booking',
      startsAt: booking.sessionAt,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      bookingId: booking.id,
    }));

    return [...classSessions, ...bookingSessions].sort(
      (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
    );
  }

  private async aggregateLearners(coachProfileId: string, learnerId?: string, kind: 'all' | LearnerRecordKind = 'all') {
    const { classEnrollments, privateBookings } = await this.fetchLearnerData(coachProfileId, learnerId, kind);
    const learnerIds = Array.from(new Set([
      ...classEnrollments.map((enrollment) => enrollment.learnerId),
      ...privateBookings.map((booking) => booking.learnerId),
    ]));

    const learnerProfiles = await this.authIntegration.getUsersProfiles(learnerIds);
    const learners = new Map<string, CoachLearnerDetail>();

    for (const enrollment of classEnrollments) {
      const bucket = this.getLearnerBucket(learners, enrollment.learnerId);
      bucket.classEnrollmentCount += 1;
      if (enrollment.status === 'ACTIVE') bucket.activeClassEnrollmentCount += 1;
      if (enrollment.status === 'CANCELLED') bucket.cancelledClassEnrollmentCount += 1;
      if (enrollment.paymentStatus === 'PENDING_REVIEW') bucket.classPaymentPendingReviewCount += 1;
      if (enrollment.paymentStatus === 'SETTLED') bucket.classPaymentSettledCount += 1;
      if (enrollment.paymentStatus === 'REJECTED') bucket.classPaymentRejectedCount += 1;
      bucket.latestActivityAt = this.maxDate(bucket.latestActivityAt, this.extractLatestActivityFromClassEnrollment(enrollment));
      bucket.classEnrollments.push(enrollment);
    }

    for (const booking of privateBookings) {
      const bucket = this.getLearnerBucket(learners, booking.learnerId);
      bucket.privateBookingCount += 1;
      if (booking.status === 'PENDING_CONFIRMATION') bucket.pendingBookingCount += 1;
      if (booking.status === 'CONFIRMED') bucket.confirmedBookingCount += 1;
      if (booking.status === 'COMPLETED') bucket.completedBookingCount += 1;
      if (booking.status === 'CANCELLED') bucket.cancelledBookingCount += 1;
      if (booking.status === 'REJECTED') bucket.rejectedBookingCount += 1;
      if (booking.paymentStatus === 'PENDING_REVIEW') bucket.bookingPaymentPendingReviewCount += 1;
      if (booking.paymentStatus === 'SETTLED') bucket.bookingPaymentSettledCount += 1;
      if (booking.paymentStatus === 'REJECTED') bucket.bookingPaymentRejectedCount += 1;
      bucket.latestActivityAt = this.maxDate(bucket.latestActivityAt, this.extractLatestActivityFromBooking(booking));
      bucket.privateBookings.push(booking);
    }

    return Array.from(learners.values())
      .map((item) => ({
        ...item,
        learnerProfile: learnerProfiles.get(item.learnerId) || null,
      }))
      .sort((left, right) => {
        const leftTime = left.latestActivityAt?.getTime() ?? 0;
        const rightTime = right.latestActivityAt?.getTime() ?? 0;
        return rightTime - leftTime;
      });
  }

  async listCoachLearners(userId: string, query: ListCoachLearnersQueryDto) {
    const coachProfileId = await this.resolveCoachProfileId(userId);
    const learners = await this.aggregateLearners(coachProfileId, undefined, query.kind ?? 'all');
    const search = query.search?.trim().toLowerCase();

    const filteredLearners = search
      ? learners.filter((item) => {
          const profile = item.learnerProfile;
          return [profile?.name, profile?.email, item.learnerId].some((value) =>
            value?.toLowerCase().includes(search),
          );
        })
      : learners;

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const total = filteredLearners.length;
    const skip = (page - 1) * limit;

    return {
      data: filteredLearners.slice(skip, skip + limit).map((item) => ({
        learnerId: item.learnerId,
        learnerProfile: item.learnerProfile,
        latestActivityAt: item.latestActivityAt,
        classEnrollmentCount: item.classEnrollmentCount,
        activeClassEnrollmentCount: item.activeClassEnrollmentCount,
        cancelledClassEnrollmentCount: item.cancelledClassEnrollmentCount,
        classPaymentPendingReviewCount: item.classPaymentPendingReviewCount,
        classPaymentSettledCount: item.classPaymentSettledCount,
        classPaymentRejectedCount: item.classPaymentRejectedCount,
        privateBookingCount: item.privateBookingCount,
        pendingBookingCount: item.pendingBookingCount,
        confirmedBookingCount: item.confirmedBookingCount,
        completedBookingCount: item.completedBookingCount,
        cancelledBookingCount: item.cancelledBookingCount,
        rejectedBookingCount: item.rejectedBookingCount,
        bookingPaymentPendingReviewCount: item.bookingPaymentPendingReviewCount,
        bookingPaymentSettledCount: item.bookingPaymentSettledCount,
        bookingPaymentRejectedCount: item.bookingPaymentRejectedCount,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getCoachLearnerDashboard(userId: string) {
    const coachProfileId = await this.resolveCoachProfileId(userId);
    const learners = await this.aggregateLearners(coachProfileId, undefined, 'all');
    const now = new Date();

    const upcomingSessionCounts = await Promise.all(
      learners.map(async (learner) => ({
        learnerId: learner.learnerId,
        count: (await this.fetchUpcomingSessions(coachProfileId, learner.learnerId)).length,
      })),
    );

    const upcomingSessionMap = new Map(upcomingSessionCounts.map((item) => [item.learnerId, item.count]));

    const pendingClassPayments = learners.filter((learner) => learner.classPaymentPendingReviewCount > 0).length;
    const pendingBookingPayments = learners.filter((learner) => learner.bookingPaymentPendingReviewCount > 0).length;
    const upcomingSessionTotal = upcomingSessionCounts.reduce((sum, item) => sum + item.count, 0);

    return {
      totalLearners: learners.length,
      learnersWithPendingClassPayments: pendingClassPayments,
      learnersWithPendingBookingPayments: pendingBookingPayments,
      learnersWithUpcomingSessions: upcomingSessionCounts.filter((item) => item.count > 0).length,
      upcomingSessionTotal,
      attentionLearners: learners
        .filter((learner) =>
          learner.classPaymentPendingReviewCount > 0 ||
          learner.classPaymentRejectedCount > 0 ||
          learner.bookingPaymentPendingReviewCount > 0 ||
          learner.bookingPaymentRejectedCount > 0 ||
          (upcomingSessionMap.get(learner.learnerId) ?? 0) > 0,
        )
        .slice(0, 10)
        .map((learner) => ({
          learnerId: learner.learnerId,
          learnerProfile: learner.learnerProfile,
          latestActivityAt: learner.latestActivityAt,
          upcomingSessionCount: upcomingSessionMap.get(learner.learnerId) ?? 0,
          classPaymentPendingReviewCount: learner.classPaymentPendingReviewCount,
          classPaymentRejectedCount: learner.classPaymentRejectedCount,
          bookingPaymentPendingReviewCount: learner.bookingPaymentPendingReviewCount,
          bookingPaymentRejectedCount: learner.bookingPaymentRejectedCount,
        })),
      asOf: now,
    };
  }

  async findCoachLearner(userId: string, learnerId: string) {
    const coachProfileId = await this.resolveCoachProfileId(userId);
    const [learnerData, upcomingSessions] = await Promise.all([
      this.fetchLearnerData(coachProfileId, learnerId, 'all'),
      this.fetchUpcomingSessions(coachProfileId, learnerId),
    ]);

    if (!this.hasLearnerRelationship(learnerData.classEnrollments, learnerData.privateBookings)) {
      throw new NotFoundException('Learner not found in your classes or bookings.');
    }

    const [learner] = await this.aggregateLearners(coachProfileId, learnerId, 'all');

    if (!learner || learner.learnerId !== learnerId) {
      throw new NotFoundException('Learner not found in your classes or bookings.');
    }

    return {
      learnerProfile: learner.learnerProfile,
      summary: {
        latestActivityAt: learner.latestActivityAt,
        classEnrollmentCount: learner.classEnrollmentCount,
        activeClassEnrollmentCount: learner.activeClassEnrollmentCount,
        cancelledClassEnrollmentCount: learner.cancelledClassEnrollmentCount,
        classPaymentPendingReviewCount: learner.classPaymentPendingReviewCount,
        classPaymentSettledCount: learner.classPaymentSettledCount,
        classPaymentRejectedCount: learner.classPaymentRejectedCount,
        privateBookingCount: learner.privateBookingCount,
        pendingBookingCount: learner.pendingBookingCount,
        confirmedBookingCount: learner.confirmedBookingCount,
        completedBookingCount: learner.completedBookingCount,
        cancelledBookingCount: learner.cancelledBookingCount,
        rejectedBookingCount: learner.rejectedBookingCount,
        bookingPaymentPendingReviewCount: learner.bookingPaymentPendingReviewCount,
        bookingPaymentSettledCount: learner.bookingPaymentSettledCount,
        bookingPaymentRejectedCount: learner.bookingPaymentRejectedCount,
      },
      upcomingSessions,
      classEnrollments: learnerData.classEnrollments,
      privateBookings: learnerData.privateBookings,
    };
  }
}