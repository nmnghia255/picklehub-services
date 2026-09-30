import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { BookingCancelReason } from './booking-cancel-reason';
import { CreditService } from './credit.service';
import { NotificationService } from '../notification/notification.service';
import { PaymentTransactionService } from './payment-transaction.service';

export interface CancelledBookingRow {
  id: string;
  playerId: string;
  playerEmail?: string;
  playerName?: string;
  date: Date;
  startTime: string;
  endTime: string;
}

/**
 * Booking lifecycle operations triggered by court status transitions or by an
 * owner manual action. Kept separate from BookingService so the player-side
 * booking flow does not need to be edited for owner-initiated cancellations.
 */
@Injectable()
export class BookingCancelService {
  private readonly logger = new Logger(BookingCancelService.name);

  private readonly authServiceUrl: string;
  private readonly authInternalToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notification: NotificationService,
    private readonly configService: ConfigService,
    private readonly creditService: CreditService,
    private readonly paymentTransactions: PaymentTransactionService,
  ) {
    this.authServiceUrl =
      this.configService.get<string>('AUTH_SERVICE_URL') || 'http://auth-service:8001';
    this.authInternalToken =
      this.configService.get<string>('SERVICE_INTERNAL_TOKEN') || '';
  }

  private async fetchPlayerDetails(userIds: string[]): Promise<Map<string, { name: string; email: string }>> {
    if (userIds.length === 0) return new Map();
    const uniqueIds = Array.from(new Set(userIds));
    
    try {
      const url = `${this.authServiceUrl}/api/auth/internal/users/batch`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': this.authInternalToken,
        },
        body: JSON.stringify({ userIds: uniqueIds }),
      });

      if (!response.ok) return new Map();
      const users: any[] = await response.json();
      const playerMap = new Map();
      users.forEach(u => playerMap.set(u.id, { name: u.name, email: u.email }));
      return playerMap;
    } catch {
      return new Map();
    }
  }

  /**
   * Cancel every future booking under a court inside the given transaction.
   * Returns the cancelled rows so the caller can fan out notifications AFTER
   * the outer transaction commits.
   *
   * "Future" = date >= today (date-only) AND status in (PENDING, CONFIRMED).
   */
  async cancelFutureBookingsForCourt(
    tx: Prisma.TransactionClient,
    courtId: string,
    reason: BookingCancelReason,
  ): Promise<CancelledBookingRow[]> {
    const today = startOfToday();

    const futureBookingItems = await tx.bookingItem.findMany({
      where: {
        courtId,
        booking: {
          date: { gte: today },
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        },
      },
      select: {
        bookingId: true,
        startTime: true,
        endTime: true,
        court: {
          select: {
            name: true,
            center: { select: { name: true } },
          },
        },
        booking: {
          select: {
            id: true,
            playerId: true,
            playerName: true,
            date: true,
            bookingProducts: {
              select: {
                productId: true,
                quantity: true,
              },
            },
          },
        },
      },
    });

    if (futureBookingItems.length === 0) return [];

    const bookingMap = new Map<string, {
      id: string;
      playerId: string;
      playerName?: string | null;
      date: Date;
      startTime: string;
      endTime: string;
      courtName: string;
      centerName: string;
      bookingProducts: Array<{ productId: string; quantity: number }>;
    }>();

    for (const item of futureBookingItems) {
      const existing = bookingMap.get(item.bookingId);
      if (!existing) {
        bookingMap.set(item.bookingId, {
          id: item.booking.id,
          playerId: item.booking.playerId,
          playerName: item.booking.playerName,
          date: item.booking.date,
          startTime: item.startTime,
          endTime: item.endTime,
          courtName: item.court.name,
          centerName: item.court.center.name,
          bookingProducts: item.booking.bookingProducts,
        });
      } else {
        if (item.startTime < existing.startTime) {
          existing.startTime = item.startTime;
          existing.courtName = item.court.name;
        }
        if (item.endTime > existing.endTime) {
          existing.endTime = item.endTime;
        }
      }
    }

    const futureBookings = Array.from(bookingMap.values());

    await tx.booking.updateMany({
      where: { id: { in: futureBookings.map((b) => b.id) } },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });

    for (const booking of futureBookings) {
      for (const productItem of booking.bookingProducts) {
        await tx.product.update({
          where: { id: productItem.productId },
          data: {
            stock: { increment: productItem.quantity },
          },
        });
      }

      await this.paymentTransactions.voidPendingPayment(tx, booking.id, reason);
    }

    const playerIds = futureBookings.map(b => b.playerId);
    const playerMap = await this.fetchPlayerDetails(playerIds);

    const enriched = futureBookings.map(b => ({
      ...b,
      playerName: b.playerName || playerMap.get(b.playerId)?.name,
      playerEmail: playerMap.get(b.playerId)?.email,
    }));

    this.logger.log(
      `Cancelled ${futureBookings.length} future booking(s) for court ${courtId} (reason=${reason})`,
    );

    return enriched;
  }

  /**
   * Owner-initiated cancellation of a single booking. Verifies ownership via
   * Booking -> Court -> SportCenter.ownerId, cancels the booking, fires
   * notification after commit.
   */
  async cancelBookingByOwner(
    ownerUserId: string,
    bookingId: string,
    reason: BookingCancelReason = 'OWNER_MANUAL',
  ): Promise<Prisma.BookingGetPayload<Record<string, never>>> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        center: {
          select: { id: true, ownerId: true, name: true },
        },
        bookingItems: {
          include: { court: true },
        },
        bookingProducts: {
          select: {
            productId: true,
            quantity: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.center.ownerId !== ownerUserId) {
      throw new ForbiddenException('Not the owner of this sport center');
    }
    if (
      booking.status === BookingStatus.CANCELLED ||
      booking.status === BookingStatus.COMPLETED
    ) {
      throw new BadRequestException(
        `Cannot cancel booking with status ${booking.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of booking.bookingProducts) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
          },
        });
      }

      const cancelled = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });

      await this.paymentTransactions.voidPendingPayment(tx, bookingId, reason);

      // Owner-initiated cancellation of a CONFIRMED booking: player always gets 100% back
      if (booking.status === BookingStatus.CONFIRMED && booking.totalPrice) {
        const centerId = booking.center.id;
        const refundAmount = Number(booking.totalPrice);
        await this.creditService.refundCredit(
          tx,
          booking.playerId,
          centerId,
          bookingId,
          refundAmount,
          'Full preservation credit refund for owner-initiated cancellation',
        );
      }

      return cancelled;
    });

    // Skip notification if booking has no player (future walk-ins from commit 4).
    if (booking.playerId) {
      const playerMap = await this.fetchPlayerDetails([booking.playerId]);
      const player = playerMap.get(booking.playerId);
      const sortedStartTimes = booking.bookingItems.map(item => item.startTime).sort();
      const sortedEndTimes = booking.bookingItems.map(item => item.endTime).sort();
      const firstCourtName = booking.bookingItems[0]?.court?.name ?? 'Court';
      const bookingDetailsHtml = booking.bookingItems
        .map(item => `<li><strong>${item.court?.name ?? 'Court'}:</strong> ${item.startTime} - ${item.endTime}</li>`)
        .join('');

      await this.notification.sendBookingCancelledNotification(
        [
          {
            playerId: booking.playerId,
            playerEmail: player?.email,
            playerName: booking.playerName || player?.name,
            bookingId: booking.id,
            date: booking.date,
            startTime: sortedStartTimes[0] ?? '00:00',
            endTime: sortedEndTimes[sortedEndTimes.length - 1] ?? '00:00',
            bookingDetailsHtml,
          },
        ],
        firstCourtName,
        booking.center.name,
        reason,
      );
    }

    return updated;
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
