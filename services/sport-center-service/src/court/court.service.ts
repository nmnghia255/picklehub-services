import { Injectable, NotFoundException } from '@nestjs/common';
import { Court, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CourtStatusDto, CreateCourtDto } from './dto/create-court.dto';
import { UpdateCourtDto } from './dto/update-court.dto';
import { BookingCancelService } from '../booking/booking-cancel.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class CourtService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingCancel: BookingCancelService,
    private readonly notification: NotificationService,
  ) {}

  /**
   * Ensures the parent sport center exists before processing child court actions.
   */
  private async ensureCenterExists(centerId: string): Promise<void> {
    const center = await this.prisma.sportCenter.findUnique({
      where: { id: centerId },
      select: { id: true },
    });

    if (!center) {
      throw new NotFoundException('Sport center not found');
    }
  }

  /**
   * Creates a court under a specific sport center.
   */
  async create(centerId: string, createCourtDto: CreateCourtDto) {
    // Parent context comes from route params, never from request body.
    await this.ensureCenterExists(centerId);

    return this.prisma.court.create({
      data: {
        centerId,
        name: createCourtDto.name,
        type: createCourtDto.type,
        status: createCourtDto.status ?? CourtStatusDto.ACTIVE,
      },
    });
  }

  /**
   * Lists all courts for a specific sport center.
   */
  async findAllByCenter(centerId: string) {
    await this.ensureCenterExists(centerId);

    return this.prisma.court.findMany({
      where: { centerId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Updates a court under a specific sport center.
   *
   * Status transition side-effects:
   *   ACTIVE -> MAINTENANCE: auto-cancel future bookings + notify players.
   *   * -> ARCHIVED: prefer the archive() endpoint (DELETE) which has the
   *     same side-effect; this PATCH path delegates if the caller forces it.
   *   ARCHIVED -> ACTIVE: allowed; already-cancelled bookings stay cancelled.
   */
  async update(centerId: string, courtId: string, updateCourtDto: UpdateCourtDto) {
    await this.ensureCenterExists(centerId);

    const existing = await this.prisma.court.findFirst({
      where: { id: courtId, centerId },
      include: { center: { select: { name: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Court not found in this sport center');
    }

    const goingToMaintenance =
      updateCourtDto.status === CourtStatusDto.MAINTENANCE &&
      existing.status === CourtStatusDto.ACTIVE;

    const goingToArchived =
      updateCourtDto.status === CourtStatusDto.ARCHIVED &&
      existing.status !== CourtStatusDto.ARCHIVED;

    if (goingToMaintenance) {
      return this.applyCourtStatusChange(
        courtId,
        { ...updateCourtDto },
        'COURT_MAINTENANCE',
        { courtName: existing.name, centerName: existing.center.name },
      );
    }

    if (goingToArchived) {
      return this.applyCourtStatusChange(
        courtId,
        { ...updateCourtDto },
        'COURT_ARCHIVED',
        { courtName: existing.name, centerName: existing.center.name },
      );
    }

    return this.prisma.court.update({
      where: { id: courtId },
      data: { ...updateCourtDto },
    });
  }

  /**
   * Soft-deletes a court by transitioning status to ARCHIVED. Auto-cancels
   * any future bookings under the court and notifies their players.
   */
  async archive(centerId: string, courtId: string) {
    await this.ensureCenterExists(centerId);

    const existing = await this.prisma.court.findFirst({
      where: { id: courtId, centerId },
      include: { center: { select: { name: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Court not found in this sport center');
    }

    return this.applyCourtStatusChange(
      courtId,
      { status: CourtStatusDto.ARCHIVED },
      'COURT_ARCHIVED',
      { courtName: existing.name, centerName: existing.center.name },
    );
  }

  /**
   * Wraps "court status change + cancel future bookings" in a single
   * transaction, then fires notifications AFTER the transaction commits.
   * Notification failures are logged-and-swallowed; they MUST NOT roll back
   * the court status change.
   */
  private async applyCourtStatusChange(
    courtId: string,
    courtData: Prisma.CourtUpdateInput,
    reason: 'COURT_MAINTENANCE' | 'COURT_ARCHIVED',
    context: { courtName: string; centerName: string },
  ): Promise<Court> {
    const result = await this.prisma.$transaction(async (tx) => {
      const cancelledBookings = await this.bookingCancel.cancelFutureBookingsForCourt(
        tx,
        courtId,
        reason,
      );
      const court = await tx.court.update({
        where: { id: courtId },
        data: courtData,
      });
      return { court, cancelledBookings };
    });

    if (result.cancelledBookings.length > 0) {
      const recipients = result.cancelledBookings
        .filter((b) => !!b.playerId)
        .map((b) => ({
          playerId: b.playerId,
          playerEmail: b.playerEmail,
          playerName: b.playerName,
          bookingId: b.id,
          date: b.date,
          startTime: b.startTime,
          endTime: b.endTime,
        }));
      if (recipients.length > 0) {
        await this.notification.sendBookingCancelledNotification(
          recipients,
          context.courtName,
          context.centerName,
          reason,
        );
      }
    }

    return result.court;
  }
}
