import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreditService } from './credit.service';
import { NotificationService } from '../notification/notification.service';
import { PaymentTransactionService } from './payment-transaction.service';

/**
 * System-wide booking payment timeout in minutes.
 * A PENDING booking with no payment proof uploaded will be automatically
 * cancelled after this duration elapses from its createdAt timestamp.
 */
export const BOOKING_TIMEOUT_MINUTES = 10;

/**
 * Cron-driven service that automatically cancels PENDING bookings whose
 * payment window has expired (no payment proof uploaded within the timeout).
 *
 * Runs every minute and sweeps all qualifying bookings in a single query.
 * Each cancelled booking gets:
 *  - status → CANCELLED, cancelReason = PAYMENT_TIMEOUT
 *  - Product stock restored
 *  - Any pending PaymentTransaction voided
 *  - Any pre-applied preservation credit refunded
 *  - Player notified via in-app + email
 */
@Injectable()
export class BookingTimeoutService {
  private readonly logger = new Logger(BookingTimeoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
    private readonly paymentTransactions: PaymentTransactionService,
    private readonly notification: NotificationService,
  ) {}

  /**
   * Sweep every minute for expired unpaid bookings.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleBookingTimeout(): Promise<void> {
    const cutoff = new Date(Date.now() - BOOKING_TIMEOUT_MINUTES * 60_000);

    // Find all PENDING bookings with no payment proof that have exceeded the timeout
    const expiredBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING,
        paymentProofUrl: null,
        createdAt: { lt: cutoff },
      },
      include: {
        center: {
          select: { id: true, name: true },
        },
        bookingItems: {
          include: {
            court: { select: { name: true } },
          },
        },
        bookingProducts: {
          select: { productId: true, quantity: true },
        },
      },
    });

    if (expiredBookings.length === 0) return;

    this.logger.log(
      `Found ${expiredBookings.length} expired PENDING booking(s) to auto-cancel`,
    );

    for (const booking of expiredBookings) {
      try {
        await this.cancelExpiredBooking(booking);
      } catch (err) {
        // Log and continue — don't let one failure block the rest
        this.logger.error(
          `Failed to auto-cancel booking ${booking.id}: ${err}`,
        );
      }
    }
  }

  private async cancelExpiredBooking(booking: any): Promise<void> {
    const reason = 'PAYMENT_TIMEOUT';

    await this.prisma.$transaction(async (tx) => {
      // 1. Cancel the booking
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });

      // 2. Restore product stock
      for (const item of booking.bookingProducts) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // 3. Void any pending payment transaction
      await this.paymentTransactions.voidPendingPayment(tx, booking.id, reason);

      // 4. Refund preservation credit that was pre-applied at booking time
      const creditApplied = Number(booking.creditApplied ?? 0);
      if (creditApplied > 0) {
        await this.creditService.refundCredit(
          tx,
          booking.playerId,
          booking.centerId,
          booking.id,
          creditApplied,
          'Preservation credit refunded due to booking payment timeout',
        );
      }
    });

    this.logger.log(
      `Auto-cancelled booking ${booking.id} (player=${booking.playerId}, reason=${reason})`,
    );

    // 5. Send notification AFTER transaction commits (fire-and-forget)
    this.sendTimeoutNotification(booking).catch((err) =>
      this.logger.error(`Timeout notification error for booking ${booking.id}: ${err}`),
    );
  }

  private async sendTimeoutNotification(booking: any): Promise<void> {
    const sortedStartTimes = booking.bookingItems
      .map((item: any) => item.startTime)
      .sort();
    const sortedEndTimes = booking.bookingItems
      .map((item: any) => item.endTime)
      .sort();

    const firstCourtName =
      booking.bookingItems[0]?.court?.name ?? 'Court';
    const bookingDetailsHtml = booking.bookingItems
      .map(
        (item: any) =>
          `<li><strong>${item.court?.name ?? 'Court'}:</strong> ${item.startTime} - ${item.endTime}</li>`,
      )
      .join('');

    await this.notification.sendBookingCancelledNotification(
      [
        {
          playerId: booking.playerId,
          playerName: booking.playerName,
          bookingId: booking.id,
          date: booking.date,
          startTime: sortedStartTimes[0] ?? '00:00',
          endTime: sortedEndTimes[sortedEndTimes.length - 1] ?? '00:00',
          bookingDetailsHtml,
        },
      ],
      firstCourtName,
      booking.center.name,
      `payment was not received within ${BOOKING_TIMEOUT_MINUTES} minutes`,
    );
  }
}
