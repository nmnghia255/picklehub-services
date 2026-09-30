import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthIntegrationService } from '../auth-integration/auth-integration.service';
import { PrismaService } from '../prisma.service';
import { ListCoachScheduleQueryDto } from './dto/list-coach-schedule-query.dto';

type CoachScheduleKind = 'class' | 'booking';
type CoachScheduleState = 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'PENDING_CONFIRMATION';

type CoachScheduleLearnerProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
};

type CoachScheduleCoachProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  verificationStatus: string;
  locationCity: string | null;
};

type CoachScheduleItem = {
  id: string;
  kind: CoachScheduleKind;
  title: string;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  status: CoachScheduleState;
  sourceStatus: string;
  coachProfile: CoachScheduleCoachProfile;
  learnerProfile: CoachScheduleLearnerProfile | null;
  locationDescription: string | null;
  topic: string | null;
  note: string | null;
  paymentStatus: string | null;
  classId: string | null;
  bookingId: string | null;
  classTitle: string | null;
};

@Injectable()
export class CoachScheduleService {
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

  private addMinutes(start: Date, minutes: number) {
    return new Date(start.getTime() + minutes * 60 * 1000);
  }

  private normalizeClassStatus(startsAt: Date, endsAt: Date, classStatus: string, now: Date): CoachScheduleState {
    if (classStatus === 'CANCELLED') return 'CANCELLED';
    if (classStatus === 'COMPLETED') return 'COMPLETED';
    if (now >= startsAt && now <= endsAt) return 'LIVE';
    if (now > endsAt) return 'COMPLETED';
    return 'UPCOMING';
  }

  private normalizeBookingStatus(startsAt: Date, endsAt: Date, bookingStatus: string, now: Date): CoachScheduleState {
    if (bookingStatus === 'PENDING_CONFIRMATION') return 'PENDING_CONFIRMATION';
    if (bookingStatus === 'CANCELLED' || bookingStatus === 'REJECTED') return 'CANCELLED';
    if (bookingStatus === 'COMPLETED') return 'COMPLETED';
    if (bookingStatus === 'CONFIRMED') {
      if (now >= startsAt && now <= endsAt) return 'LIVE';
      if (now > endsAt) return 'COMPLETED';
      return 'UPCOMING';
    }
    return 'UPCOMING';
  }

  private matchesRequestedState(itemState: CoachScheduleState, requestedState: ListCoachScheduleQueryDto['state']) {
    switch (requestedState ?? 'upcoming') {
      case 'all':
        return true;
      case 'live':
        return itemState === 'LIVE';
      case 'pending':
        return itemState === 'PENDING_CONFIRMATION';
      case 'past':
        return itemState === 'COMPLETED' || itemState === 'CANCELLED';
      case 'upcoming':
      default:
        return itemState === 'UPCOMING' || itemState === 'LIVE';
    }
  }

  private buildSummary(items: CoachScheduleItem[]) {
    const summary = {
      total: items.length,
      classCount: 0,
      bookingCount: 0,
      upcomingCount: 0,
      liveCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      pendingConfirmationCount: 0,
      distinctLearnerCount: 0,
      nextSessionAt: null as Date | null,
      lastSessionAt: null as Date | null,
    };

    const learnerIds = new Set<string>();
    for (const item of items) {
      if (item.learnerProfile?.id) learnerIds.add(item.learnerProfile.id);
      if (item.kind === 'class') summary.classCount += 1;
      if (item.kind === 'booking') summary.bookingCount += 1;
      if (item.status === 'UPCOMING') summary.upcomingCount += 1;
      if (item.status === 'LIVE') summary.liveCount += 1;
      if (item.status === 'COMPLETED') summary.completedCount += 1;
      if (item.status === 'CANCELLED') summary.cancelledCount += 1;
      if (item.status === 'PENDING_CONFIRMATION') summary.pendingConfirmationCount += 1;
      if (!summary.nextSessionAt || item.startsAt < summary.nextSessionAt) summary.nextSessionAt = item.startsAt;
      if (!summary.lastSessionAt || item.startsAt > summary.lastSessionAt) summary.lastSessionAt = item.startsAt;
    }

    summary.distinctLearnerCount = learnerIds.size;
    return summary;
  }

  private async fetchCombinedItems(userId: string, query: ListCoachScheduleQueryDto) {
    const coachProfileId = await this.resolveCoachProfileId(userId);
    const now = new Date();
    const sort = query.sort ?? 'asc';
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;

    const classSchedulesPromise = query.kind !== 'booking'
      ? this.prisma.classSchedule.findMany({
          where: {
            ...(query.classId ? { classId: query.classId } : {}),
            ...(from || to ? {
              scheduledAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            } : {}),
            coachClass: {
              coachProfileId,
              ...(query.learnerId ? { enrollments: { some: { learnerId: query.learnerId, status: 'ACTIVE' } } } : {}),
            },
          },
          select: {
            id: true,
            classId: true,
            scheduledAt: true,
            durationMinutes: true,
            topic: true,
            note: true,
            coachClass: {
              select: {
                id: true,
                title: true,
                status: true,
                locationDescription: true,
                coachProfile: {
                  select: {
                    id: true,
                    displayName: true,
                    avatarUrl: true,
                    verificationStatus: true,
                    locationCity: true,
                  },
                },
              },
            },
          },
          orderBy: { scheduledAt: sort },
        })
      : Promise.resolve([] as Array<never>);

    const privateBookingsPromise = query.kind !== 'class'
      ? this.prisma.privateBooking.findMany({
          where: {
            coachProfileId,
            ...(query.learnerId ? { learnerId: query.learnerId } : {}),
            ...(from || to ? {
              sessionAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            } : {}),
          },
          select: {
            id: true,
            coachProfileId: true,
            learnerId: true,
            sessionAt: true,
            durationMinutes: true,
            status: true,
            paymentStatus: true,
            learnerNote: true,
            coachNote: true,
            coachProfile: {
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                verificationStatus: true,
                locationCity: true,
              },
            },
          },
          orderBy: { sessionAt: sort },
        })
      : Promise.resolve([] as Array<never>);

    const [classSchedules, privateBookings] = await Promise.all([classSchedulesPromise, privateBookingsPromise]);
    const learnerIds = Array.from(new Set(privateBookings.map((booking) => booking.learnerId).filter(Boolean)));
    const learnerProfiles = await this.authIntegration.getUsersProfiles(learnerIds);

    const classItems = classSchedules.map((schedule) => {
      const endsAt = this.addMinutes(schedule.scheduledAt, schedule.durationMinutes);
      return {
        id: schedule.id,
        kind: 'class' as const,
        title: schedule.coachClass.title,
        startsAt: schedule.scheduledAt,
        endsAt,
        durationMinutes: schedule.durationMinutes,
        status: this.normalizeClassStatus(schedule.scheduledAt, endsAt, schedule.coachClass.status, now),
        sourceStatus: schedule.coachClass.status,
        coachProfile: schedule.coachClass.coachProfile,
        learnerProfile: null,
        locationDescription: schedule.coachClass.locationDescription,
        topic: schedule.topic,
        note: schedule.note,
        paymentStatus: null,
        classId: schedule.classId,
        bookingId: null,
        classTitle: schedule.coachClass.title,
      };
    });

    const bookingItems = privateBookings.map((booking) => {
      const endsAt = this.addMinutes(booking.sessionAt, booking.durationMinutes);
      return {
        id: booking.id,
        kind: 'booking' as const,
        title: `Private booking with ${learnerProfiles.get(booking.learnerId)?.name || 'Learner'}`,
        startsAt: booking.sessionAt,
        endsAt,
        durationMinutes: booking.durationMinutes,
        status: this.normalizeBookingStatus(booking.sessionAt, endsAt, booking.status, now),
        sourceStatus: booking.status,
        coachProfile: booking.coachProfile,
        learnerProfile: learnerProfiles.get(booking.learnerId) || null,
        locationDescription: booking.coachProfile.locationCity,
        topic: null,
        note: booking.coachNote ?? booking.learnerNote,
        paymentStatus: booking.paymentStatus,
        classId: null,
        bookingId: booking.id,
        classTitle: null,
      };
    });

    return [...classItems, ...bookingItems]
      .filter((item) => this.matchesRequestedState(item.status, query.state))
      .sort((left, right) => {
        const delta = left.startsAt.getTime() - right.startsAt.getTime();
        return sort === 'asc' ? delta : -delta;
      });
  }

  async getCoachScheduleItems(userId: string, query: ListCoachScheduleQueryDto) {
    return this.fetchCombinedItems(userId, query);
  }

  async listCoachSchedule(userId: string, query: ListCoachScheduleQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const sort = query.sort ?? 'asc';

    const combinedItems = await this.fetchCombinedItems(userId, query);

    const total = combinedItems.length;
    const data = combinedItems.slice(skip, skip + limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      summary: this.buildSummary(combinedItems),
      filters: {
        kind: query.kind ?? 'all',
        state: query.state ?? 'upcoming',
        learnerId: query.learnerId ?? null,
        classId: query.classId ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
        page,
        limit,
        sort,
      },
    };
  }
}