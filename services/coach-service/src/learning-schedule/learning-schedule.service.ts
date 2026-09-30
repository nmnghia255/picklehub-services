import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ListLearningScheduleQueryDto } from './dto/list-learning-schedule-query.dto';
import { SportCenterIntegrationService, CourtInfo } from '../sport-center-integration/sport-center-integration.service';

type LearningScheduleKind = 'class' | 'booking';
type LearningScheduleState = 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'PENDING_CONFIRMATION';

type LearningScheduleCoachProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  verificationStatus: string;
  locationCity: string | null;
};

type LearningScheduleItem = {
  id: string;
  kind: LearningScheduleKind;
  title: string;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  status: LearningScheduleState;
  sourceStatus: string;
  coachProfile: LearningScheduleCoachProfile;
  locationDescription: string | null;
  courtId: string | null;
  topic: string | null;
  note: string | null;
  paymentStatus: string | null;
  priceVnd: number | null;           // booking price in VND; null for class items
  coverImageUrl: string | null;      // class cover image; null for booking items
  actions: string[];                 // computed list of available actions for this item
  classId: string | null;
  bookingId: string | null;
};

@Injectable()
export class LearningScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sportCenterIntegration: SportCenterIntegrationService,
  ) {}

  private addMinutes(start: Date, minutes: number) {
    return new Date(start.getTime() + minutes * 60 * 1000);
  }

  private normalizeClassStatus(
    startsAt: Date,
    endsAt: Date,
    classStatus: string,
    now: Date,
  ): LearningScheduleState {
    if (classStatus === 'CANCELLED') return 'CANCELLED';
    if (classStatus === 'COMPLETED') return 'COMPLETED';
    if (now >= startsAt && now <= endsAt) return 'LIVE';
    if (now > endsAt) return 'COMPLETED';
    return 'UPCOMING';
  }

  private normalizeBookingStatus(
    startsAt: Date,
    endsAt: Date,
    bookingStatus: string,
    now: Date,
  ): LearningScheduleState {
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

  private matchesRequestedState(itemState: LearningScheduleState, requestedState: ListLearningScheduleQueryDto['state']) {
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

  /**
   * Compute available actions for a class session item.
   * Gives the frontend an explicit list to drive button rendering — no business logic on client.
   */
  private classActions(status: LearningScheduleState): string[] {
    const actions: string[] = ['VIEW_CLASS'];
    if (status === 'UPCOMING' || status === 'LIVE') actions.push('VIEW_COACH');
    return actions;
  }

  /**
   * Compute available actions for a private booking item.
   */
  private bookingActions(
    status: LearningScheduleState,
    paymentStatus: string | null,
    courtId: string | null,
  ): string[] {
    const actions: string[] = ['VIEW_BOOKING'];
    if (status === 'PENDING_CONFIRMATION') return actions; // nothing the learner can do yet
    if (status === 'CANCELLED') return actions;
    if (paymentStatus === 'PENDING_PROOF') actions.push('UPLOAD_PAYMENT_PROOF');
    if (paymentStatus === 'SETTLED' && status === 'COMPLETED') actions.push('LEAVE_REVIEW');
    if (courtId) actions.push('VIEW_COURT');
    if (status === 'UPCOMING') actions.push('CANCEL');
    return actions;
  }


  private buildClassItem(schedule: {
    id: string;
    classId: string;
    scheduledAt: Date;
    durationMinutes: number;
    topic: string | null;
    note: string | null;
    locationDescription: string | null;
    courtId: string | null;
    coachClass: {
      id: string;
      title: string;
      locationDescription: string | null;
      coverImageUrl: string | null;
      status: string;
      coachProfile: LearningScheduleCoachProfile;
    };
  }, now: Date): LearningScheduleItem {
    const endsAt = this.addMinutes(schedule.scheduledAt, schedule.durationMinutes);
    const status = this.normalizeClassStatus(schedule.scheduledAt, endsAt, schedule.coachClass.status, now);

    // Priority: session.courtId (resolved later) > session.locationDescription > class.locationDescription
    const fallbackLocation = schedule.locationDescription ?? schedule.coachClass.locationDescription;

    return {
      id: schedule.id,
      kind: 'class',
      title: schedule.coachClass.title,
      startsAt: schedule.scheduledAt,
      endsAt,
      durationMinutes: schedule.durationMinutes,
      status,
      sourceStatus: schedule.coachClass.status,
      coachProfile: schedule.coachClass.coachProfile,
      locationDescription: fallbackLocation,
      courtId: schedule.courtId,
      topic: schedule.topic,
      note: schedule.note,
      paymentStatus: null,
      priceVnd: null,
      coverImageUrl: schedule.coachClass.coverImageUrl,
      actions: this.classActions(status),
      classId: schedule.classId,
      bookingId: null,
    };
  }

  private buildBookingItem(booking: {
    id: string;
    sessionAt: Date;
    durationMinutes: number;
    status: string;
    paymentStatus: string | null;
    priceVnd: number;
    learnerNote: string | null;
    coachNote: string | null;
    locationDescription: string | null;
    courtId: string | null;
    coachProfile: LearningScheduleCoachProfile;
  }, now: Date): LearningScheduleItem {
    const endsAt = this.addMinutes(booking.sessionAt, booking.durationMinutes);
    const status = this.normalizeBookingStatus(booking.sessionAt, endsAt, booking.status, now);

    // Priority: booking.courtId (resolved later) > booking.locationDescription > coachProfile.locationCity
    const fallbackLocation = booking.locationDescription ?? booking.coachProfile.locationCity;

    return {
      id: booking.id,
      kind: 'booking',
      title: `Private session with ${booking.coachProfile.displayName}`,
      startsAt: booking.sessionAt,
      endsAt,
      durationMinutes: booking.durationMinutes,
      status,
      sourceStatus: booking.status,
      coachProfile: booking.coachProfile,
      locationDescription: fallbackLocation,
      courtId: booking.courtId,
      topic: null,
      note: booking.coachNote ?? booking.learnerNote,
      paymentStatus: booking.paymentStatus,
      priceVnd: booking.priceVnd,
      coverImageUrl: null,
      actions: this.bookingActions(status, booking.paymentStatus, booking.courtId),
      classId: null,
      bookingId: booking.id,
    };
  }

  private buildSummary(items: LearningScheduleItem[]) {
    const summary = {
      total: items.length,
      classCount: 0,
      bookingCount: 0,
      upcomingCount: 0,
      liveCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      pendingConfirmationCount: 0,
      distinctCoachCount: 0,
      nextSessionAt: null as Date | null,
      lastSessionAt: null as Date | null,
    };

    const coachIds = new Set<string>();

    for (const item of items) {
      coachIds.add(item.coachProfile.id);

      if (item.kind === 'class') summary.classCount += 1;
      if (item.kind === 'booking') summary.bookingCount += 1;

      if (item.status === 'UPCOMING') summary.upcomingCount += 1;
      if (item.status === 'LIVE') summary.liveCount += 1;
      if (item.status === 'COMPLETED') summary.completedCount += 1;
      if (item.status === 'CANCELLED') summary.cancelledCount += 1;
      if (item.status === 'PENDING_CONFIRMATION') summary.pendingConfirmationCount += 1;

      if (!summary.nextSessionAt || item.startsAt < summary.nextSessionAt) {
        summary.nextSessionAt = item.startsAt;
      }
      if (!summary.lastSessionAt || item.startsAt > summary.lastSessionAt) {
        summary.lastSessionAt = item.startsAt;
      }
    }

    summary.distinctCoachCount = coachIds.size;
    return summary;
  }

  /**
   * Enrich items that have a courtId by resolving the full address from sport-center-service.
   * All courtIds from both class and booking items are batched into a single HTTP call.
   */
  private async enrichWithCourtLocations(items: LearningScheduleItem[]): Promise<LearningScheduleItem[]> {
    const courtIds = items.map((i) => i.courtId).filter((id): id is string => Boolean(id));
    if (courtIds.length === 0) return items;

    const courtMap: Map<string, CourtInfo> = await this.sportCenterIntegration.getBatchCourts(courtIds);

    return items.map((item) => {
      if (!item.courtId) return item;
      const court = courtMap.get(item.courtId);
      if (!court) return item;
      return {
        ...item,
        locationDescription: `${court.name}, ${court.centerName}, ${court.centerAddress}`,
      };
    });
  }

  private async fetchCombinedItems(userId: string, query: ListLearningScheduleQueryDto) {
    const now = new Date();
    const sort = query.sort ?? 'asc';

    const explicitFrom = query.from ? new Date(query.from) : null;
    const explicitTo = query.to ? new Date(query.to) : null;

    const classSchedulesPromise = query.kind !== 'booking'
      ? this.prisma.classSchedule.findMany({
          where: {
            ...(query.classId ? { classId: query.classId } : {}),
            ...(explicitFrom || explicitTo ? {
              scheduledAt: {
                ...(explicitFrom ? { gte: explicitFrom } : {}),
                ...(explicitTo ? { lte: explicitTo } : {}),
              },
            } : {}),
            coachClass: {
              ...(query.coachProfileId ? { coachProfileId: query.coachProfileId } : {}),
              enrollments: {
                some: {
                  learnerId: userId,
                  status: 'ACTIVE',
                },
              },
            },
          },
          include: {
            coachClass: {
              select: {
                id: true,
                title: true,
                locationDescription: true,
                coverImageUrl: true,
                status: true,
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
            learnerId: userId,
            ...(query.coachProfileId ? { coachProfileId: query.coachProfileId } : {}),
            ...(explicitFrom || explicitTo ? {
              sessionAt: {
                ...(explicitFrom ? { gte: explicitFrom } : {}),
                ...(explicitTo ? { lte: explicitTo } : {}),
              },
            } : {}),
          },
          select: {
            id: true,
            sessionAt: true,
            durationMinutes: true,
            status: true,
            paymentStatus: true,
            priceVnd: true,
            learnerNote: true,
            coachNote: true,
            locationDescription: true,
            courtId: true,
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

    const classItems = (classSchedules as any[]).map((schedule) => this.buildClassItem(schedule, now));
    const bookingItems = (privateBookings as any[]).map((booking) => this.buildBookingItem(booking, now));

    const combined = [...classItems, ...bookingItems]
      .filter((item) => this.matchesRequestedState(item.status, query.state))
      .sort((left, right) => {
        const delta = left.startsAt.getTime() - right.startsAt.getTime();
        return sort === 'asc' ? delta : -delta;
      });

    // Batch-enrich all court locations in a single cross-service call
    return this.enrichWithCourtLocations(combined);
  }

  async getLearnerScheduleItems(userId: string, query: ListLearningScheduleQueryDto) {
    return this.fetchCombinedItems(userId, query);
  }

  async listLearnerSchedule(userId: string, query: ListLearningScheduleQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const combinedItems = await this.fetchCombinedItems(userId, query);

    const total = combinedItems.length;
    const paginatedItems = combinedItems.slice(skip, skip + limit);

    return {
      data: paginatedItems,
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
        coachProfileId: query.coachProfileId ?? null,
        classId: query.classId ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
        page,
        limit,
        sort: query.sort ?? 'asc',
      },
    };
  }
}