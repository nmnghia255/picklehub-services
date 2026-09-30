import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { GroupMemberRole } from '@prisma/client';
import { LinkCourtBookingDto } from './dto/link-court-booking.dto';
import { ListCourtBookingsQueryDto } from './dto/list-court-bookings.query.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

/** One entry per BookingItem row — never merged even if same court appears multiple times on the same day. */
interface BookingItemSnapshot {
  bookingId: string;
  date: string;        // "YYYY-MM-DD"
  courtId: string;
  courtName: string;
  startTime: string;  // "HH:MM"
  endTime: string;    // "HH:MM"
}

@Injectable()
export class CourtBookingService {
  private readonly logger = new Logger(CourtBookingService.name);
  private readonly centerAxios: AxiosInstance;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @InjectQueue('activity-reminder-queue') private readonly reminderQueue: Queue,
  ) {
    // Same pattern as event-service SessionService
    this.centerAxios = axios.create({
      baseURL: this.configService.get<string>('SPORT_CENTER_SERVICE_URL'),
      headers: {
        'X-Internal-Service-Token': this.configService.get<string>('SERVICE_INTERNAL_TOKEN'),
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private extractDatePart(dateValue: unknown): string | null {
    if (typeof dateValue === 'string') return dateValue.slice(0, 10);
    if (dateValue instanceof Date) return dateValue.toISOString().slice(0, 10);
    return null;
  }

  /**
   * Builds a flat snapshot — one entry per BookingItem, never merged.
   * A court can appear multiple times on the same day with different time windows
   * (e.g. Court 1: 08:00–09:00 AND Court 1: 10:00–11:00) and both rows are kept.
   */
  private buildBookingItemsSnapshot(bookingInfos: any[]): BookingItemSnapshot[] {
    const items: BookingItemSnapshot[] = [];

    for (const booking of bookingInfos) {
      const date = this.extractDatePart(booking?.date);

      // Group items by courtId
      const courtMap = new Map<string, any[]>();
      for (const item of booking?.bookingItems ?? []) {
        if (!item?.court?.id || !item.startTime || !item.endTime || !date) continue;
        const cId = item.court.id;
        if (!courtMap.has(cId)) courtMap.set(cId, []);
        courtMap.get(cId)!.push({ ...item, date, bookingId: booking.id });
      }

      // Merge contiguous/overlapping times for each court
      for (const [courtId, courtItems] of courtMap.entries()) {
        // Sort by startTime
        courtItems.sort((a, b) => a.startTime.localeCompare(b.startTime));

        let current = courtItems[0];
        for (let i = 1; i < courtItems.length; i++) {
          const next = courtItems[i];
          // If next starts before or exactly when current ends, merge them
          if (next.startTime <= current.endTime) {
            // Extend endTime if next ends later
            if (next.endTime > current.endTime) {
              current.endTime = next.endTime;
            }
          } else {
            // Non-contiguous, push current and start new
            items.push({
              bookingId: current.bookingId,
              date: current.date,
              courtId,
              courtName: current.court.name ?? '',
              startTime: current.startTime,
              endTime: current.endTime,
            });
            current = next;
          }
        }
        // Push the last one
        items.push({
          bookingId: current.bookingId,
          date: current.date,
          courtId,
          courtName: current.court.name ?? '',
          startTime: current.startTime,
          endTime: current.endTime,
        });
      }
    }

    return items;
  }

  /**
   * Derives overall startTime / endTime from the snapshot.
   * Converts "HH:MM" strings to full Date objects using the booking date + UTC+7.
   */
  private deriveSessionWindow(
    snapshot: BookingItemSnapshot[],
  ): { startTime: Date; endTime: Date } | null {
    if (snapshot.length === 0) return null;

    let minMs = Infinity;
    let maxMs = -Infinity;

    for (const item of snapshot) {
      const startMs = Date.parse(`${item.date}T${item.startTime}:00+07:00`);
      const endMs   = Date.parse(`${item.date}T${item.endTime}:00+07:00`);
      if (!Number.isNaN(startMs) && startMs < minMs) minMs = startMs;
      if (!Number.isNaN(endMs)   && endMs   > maxMs) maxMs = endMs;
    }

    if (!isFinite(minMs) || !isFinite(maxMs)) return null;
    return { startTime: new Date(minMs), endTime: new Date(maxMs) };
  }

  /**
   * Auto-generates a title from date when the owner does not supply one.
   * Format: "Court Booking · DD/MM/YYYY"
   */
  private autoTitle(datePart: string): string {
    const [year, month, day] = datePart.split('-');
    return `Court Booking · ${day}/${month}/${year}`;
  }

  /** Asserts caller is an OWNER of the group. */
  private async assertOwner(userId: string, groupId: string) {
    const [group, membership] = await Promise.all([
      this.prisma.group.findUnique({ where: { id: groupId } }),
      this.prisma.groupMember.findUnique({
        where: { userId_groupId: { userId, groupId } },
      }),
    ]);

    if (!group) throw new NotFoundException('Group not found');
    if (!membership) throw new ForbiddenException('You are not a member of this group');
    if (membership.role !== GroupMemberRole.OWNER) {
      throw new ForbiddenException('Only the group OWNER can manage court bookings');
    }

    return group;
  }

  /** Asserts caller is any member (OWNER or MEMBER) of the group. */
  private async assertMember(userId: string, groupId: string) {
    const [group, membership] = await Promise.all([
      this.prisma.group.findUnique({ where: { id: groupId } }),
      this.prisma.groupMember.findUnique({
        where: { userId_groupId: { userId, groupId } },
      }),
    ]);

    if (!group) throw new NotFoundException('Group not found');
    if (!membership) throw new ForbiddenException('You are not a member of this group');

    return group;
  }

  // ---------------------------------------------------------------------------
  // Public methods
  // ---------------------------------------------------------------------------

  /**
   * Links one or more owner court bookings to a group.
   *
   * Validation rules:
   * - Caller must be the group OWNER.
   * - All bookings must belong to the caller (playerId === ownerId).
   * - All bookings must be CONFIRMED or COMPLETED.
   * - All bookings must belong to the same sport center.
   * - All bookings must share the same date.
   * - No booking may already be linked to this group.
   */
  async linkCourtBooking(ownerId: string, groupId: string, dto: LinkCourtBookingDto) {
    await this.assertOwner(ownerId, groupId);

    // Fetch live booking data from sport-center-service
    let bookingInfos: any[];
    try {
      const res = await this.centerAxios.post('/api/bookings/batch', {
        bookingIds: [dto.bookingId],
      });
      bookingInfos = res.data?.bookingInfos ?? [];
    } catch (err: any) {
      this.logger.error('Failed to fetch booking batch:', err?.message);
      throw new BadRequestException(
        'Failed to fetch booking details from sport-center-service: ' + (err?.message ?? 'unknown error'),
      );
    }

    if (!Array.isArray(bookingInfos) || bookingInfos.length === 0) {
      throw new BadRequestException('No bookings found for the provided booking IDs');
    }

    // Validate: the provided ID was found
    if (bookingInfos.length !== 1 || bookingInfos[0].id !== dto.bookingId) {
      throw new BadRequestException('The booking ID was not found');
    }

    // Validate: all bookings belong to the caller
    const notOwned = bookingInfos.filter((b) => b.playerId !== ownerId);
    if (notOwned.length > 0) {
      throw new ForbiddenException(
        'All bookings must belong to you. You can only link your own bookings.',
      );
    }

    // Validate: all bookings are CONFIRMED or COMPLETED
    const invalidStatus = bookingInfos.filter(
      (b) => b.status !== 'CONFIRMED' && b.status !== 'COMPLETED',
    );
    if (invalidStatus.length > 0) {
      throw new BadRequestException(
        'All bookings must be CONFIRMED or COMPLETED. ' +
        `Rejected: ${invalidStatus.map((b) => `${b.id} (${b.status})`).join(', ')}`,
      );
    }

    // Validate: same center
    const centerIds = new Set(bookingInfos.map((b) => b.center?.id).filter(Boolean));
    if (centerIds.size !== 1) {
      throw new BadRequestException('All bookings must belong to the same sport center');
    }

    // Validate: same date
    const dates = new Set(bookingInfos.map((b) => this.extractDatePart(b.date)).filter(Boolean));
    if (dates.size !== 1) {
      throw new BadRequestException('All bookings must share the same date');
    }

    const datePart = dates.values().next().value as string;

    // Validate: no booking already linked to this group
    const existing = await this.prisma.groupCourtBooking.findFirst({
      where: {
        groupId,
        bookingId: dto.bookingId,
      },
    });
    if (existing) {
      throw new ConflictException(
        'One or more bookings are already linked to this group',
      );
    }

    // Build snapshot and derive window
    const snapshot  = this.buildBookingItemsSnapshot(bookingInfos);
    const window    = this.deriveSessionWindow(snapshot);

    if (!window) {
      throw new BadRequestException('Could not derive session times from booking items');
    }

    const firstCenter       = bookingInfos[0].center;
    const totalBookingCost  = bookingInfos.reduce((sum, b) => sum + Number(b.totalPrice ?? 0), 0);
    const title             = dto.title?.trim() || this.autoTitle(datePart);

    const record = await this.prisma.groupCourtBooking.create({
      data: {
        groupId,
        title,
        note:                dto.note,
        linkedById:          ownerId,
        bookingId:           dto.bookingId,
        centerId:            firstCenter?.id  ?? null,
        centerName:          firstCenter?.name ?? null,
        centerAddress:       firstCenter?.address ?? null,
        totalBookingCost,
        date:                new Date(datePart),
        startTime:           window.startTime,
        endTime:             window.endTime,
        bookingItemsSnapshot: snapshot as any,
      },
    });

    return {
      message: 'Court bookings linked to group successfully',
      data: record,
    };
  }

  /**
   * Removes a court booking link from a group. OWNER only.
   */
  async unlinkCourtBooking(ownerId: string, groupId: string, id: string) {
    await this.assertOwner(ownerId, groupId);

    const record = await this.prisma.groupCourtBooking.findFirst({
      where: { id, groupId },
    });

    if (!record) throw new NotFoundException('Court booking link not found');

    await this.prisma.groupCourtBooking.delete({ where: { id } });

    return { message: 'Court booking unlinked from group successfully' };
  }

  /**
   * Lists all court booking links for a group. Any member can call this.
   */
  async listCourtBookings(userId: string, groupId: string, query: ListCourtBookingsQueryDto) {
    await this.assertMember(userId, groupId);

    const page   = query.page  ?? 1;
    const limit  = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const where: any = { groupId };

    if (query.fromDate || query.toDate) {
      where.date = {
        ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
        ...(query.toDate   ? { lte: new Date(query.toDate)   } : {}),
      };
    }

    // Filter by linked status: true = has linked activity, false = no linked activity
    if (query.linked === true) {
      where.activities = { some: {} };
    } else if (query.linked === false) {
      where.activities = { none: {} };
    }

    // Automatically exclude past bookings when linked=false, or when excludePast is explicitly true
    if (query.excludePast === true || (query.linked === false && query.excludePast !== false)) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      where.date = {
        ...(where.date || {}),
        gte: todayStart,
      };
    }

    const [records, total] = await Promise.all([
      this.prisma.groupCourtBooking.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
        include: {
          activities: {
            select: {
              id: true,
              title: true,
              status: true,
              startAt: true,
              endAt: true,
            },
          },
        },
      }),
      this.prisma.groupCourtBooking.count({ where }),
    ]);

    // Since courtBookingId is now unique per activity, at most one activity per booking
    const data = records.map(({ activities, ...record }) => ({
      ...record,
      isLinked: activities.length > 0,
      linkedActivity: activities[0] ?? null,
    }));

    return {
      message: 'List group court bookings successfully',
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }


  /**
   * Returns a single court booking link with live status enrichment per booking.
   * Any group member can call this.
   */
  async getCourtBookingDetail(userId: string, groupId: string, id: string) {
    await this.assertMember(userId, groupId);

    const record = await this.prisma.groupCourtBooking.findFirst({
      where: { id, groupId },
      include: {
        activities: {
          select: {
            id: true,
            title: true,
            status: true,
            startAt: true,
            endAt: true,
          },
        },
      },
    });


    if (!record) throw new NotFoundException('Court booking link not found');

    // Enrich with live status from sport-center-service (best-effort)
    let liveDetails: { bookingId: string; status: string; totalPrice: number }[] = [];
    try {
      const res = await this.centerAxios.post('/api/bookings/batch', {
        bookingIds: [record.bookingId],
      });
      const infos: any[] = res.data?.bookingInfos ?? [];
      liveDetails = infos.map((b) => ({
        bookingId:  b.id,
        status:     b.status,
        totalPrice: Number(b.totalPrice ?? 0),
      }));
    } catch (err: any) {
      // Graceful degradation — return snapshot data without live status
      this.logger.warn(
        `Could not fetch live booking status for GroupCourtBooking ${id}: ${err?.message}`,
      );
    }

    const { activities, ...recordData } = record;
    return {
      message: 'Group court booking fetched successfully',
      data: {
        ...recordData,
        isLinked: activities.length > 0,
        linkedActivity: activities[0] ?? null,
        liveBookingDetails: liveDetails.length > 0 ? liveDetails : null,
      },
    };
  }

  async checkCancelEligibility(userId: string, groupId: string, bookingId: string) {
    await this.assertOwner(userId, groupId);

    const record = await this.prisma.groupCourtBooking.findFirst({
      where: { id: bookingId, groupId },
    });
    if (!record) throw new NotFoundException('Court booking link not found');

    try {
      const res = await this.centerAxios.get(
        `/api/bookings/internal/${record.bookingId}/cancellation-policy`,
      );
      return res.data;
    } catch (err: any) {
      this.logger.error(
        `Failed to check cancel eligibility for booking ${bookingId}: ${err?.message}`,
      );
      throw new BadRequestException(
        err?.response?.data?.message || 'Failed to check cancellation policy from sport center',
      );
    }
  }

  async cancelBooking(userId: string, groupId: string, bookingId: string) {
    await this.assertOwner(userId, groupId);

    const record = await this.prisma.groupCourtBooking.findFirst({
      where: { id: bookingId, groupId },
    });
    if (!record) throw new NotFoundException('Court booking link not found');

    return this.prisma.$transaction(async (tx) => {
      // 1. Call sport-center-service to execute booking cancellation
      try {
        await this.centerAxios.post(`/api/bookings/internal/${record.bookingId}/cancel`, {
          cancelReason: 'GROUP_CANCEL',
        });
      } catch (err: any) {
        this.logger.error(
          `Failed to cancel booking ${bookingId} at sport center: ${err?.message}`,
        );
        throw new BadRequestException(
          err?.response?.data?.message || 'Failed to cancel booking at sport center',
        );
      }

      // 2. Locate any GroupActivity linked to this GroupCourtBooking
      const activities = await tx.groupActivity.findMany({
        where: { courtBookingId: record.id, status: { not: 'CANCELLED' } },
      });

      // 3. Flag activities as CANCELLED, cancel reminders
      for (const activity of activities) {
        await tx.groupActivity.update({
          where: { id: activity.id },
          data: { status: 'CANCELLED' },
        });
        
        try {
          await this.reminderQueue.remove(activity.id);
        } catch (err: any) {
          this.logger.warn(`Could not remove reminder queue job for activity ${activity.id}: ${err.message}`);
        }
      }

      return {
        message: 'Booking and associated activities cancelled successfully.',
        data: {
          bookingId: record.id,
          status: 'CANCELLED',
        },
      };
    });
  }
}
