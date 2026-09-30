import { Injectable, Logger } from '@nestjs/common';
import { CreditTransactionType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────
  // Credit application (used during booking creation)
  // ─────────────────────────────────────────────────────────────

  /**
   * Attempts to apply available preservation credit to a booking inside
   * an open transaction.
   *
   * Returns the amounts actually applied and remaining to be paid in cash.
   * Writes a BOOKING_PAYMENT credit transaction for auditing.
   * The caller is responsible for persisting `creditApplied` and
   * `paymentRemaining` on the booking record.
   */
  async applyCreditToBooking(
    tx: Prisma.TransactionClient,
    playerId: string,
    centerId: string,
    bookingId: string,
    totalPrice: number,
  ): Promise<{ applied: number; remaining: number }> {
    const wallet = await tx.sportCenterCredit.findUnique({
      where: { playerId_centerId: { playerId, centerId } },
    });

    if (!wallet || Number(wallet.balance) <= 0) {
      return { applied: 0, remaining: totalPrice };
    }

    const balance = Number(wallet.balance);
    const applied = parseFloat(Math.min(balance, totalPrice).toFixed(2));
    const remaining = parseFloat((totalPrice - applied).toFixed(2));

    await tx.sportCenterCredit.update({
      where: { id: wallet.id },
      data: { balance: { decrement: applied } },
    });

    await tx.creditTransaction.create({
      data: {
        creditId: wallet.id,
        bookingId,
        amount: -applied,
        type: CreditTransactionType.BOOKING_PAYMENT,
        description: `Preservation credit applied to booking`,
      },
    });

    this.logger.log(
      `Applied ${applied} credit (balance was ${balance}) for player ${playerId} at center ${centerId}`,
    );

    return { applied, remaining };
  }

  // ─────────────────────────────────────────────────────────────
  // Credit refund (used during booking cancellation)
  // ─────────────────────────────────────────────────────────────

  /**
   * Adds `amount` to the player's credit wallet for the given center inside
   * an open transaction. Creates the wallet row if it does not yet exist.
   * No-ops when amount is 0.
   */
  async refundCredit(
    tx: Prisma.TransactionClient,
    playerId: string,
    centerId: string,
    bookingId: string,
    amount: number,
    description: string,
  ): Promise<void> {
    if (amount <= 0) return;

    const wallet = await tx.sportCenterCredit.upsert({
      where: { playerId_centerId: { playerId, centerId } },
      update: { balance: { increment: amount } },
      create: { playerId, centerId, balance: amount },
    });

    await tx.creditTransaction.create({
      data: {
        creditId: wallet.id,
        bookingId,
        amount,
        type: CreditTransactionType.CANCELLATION_REFUND,
        description,
      },
    });

    this.logger.log(
      `Refunded ${amount} as preservation credit for player ${playerId} at center ${centerId}`,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Policy helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Resolves the refund percentage to award for a player-initiated cancellation.
   *
   * Algorithm:
   *  1. Compute whole calendar days between now (UTC+7) and the booking start moment.
   *  2. Sort tiers by minDaysBeforeStart descending.
   *  3. Return the refundPercent of the first tier where daysBeforeStart >= tier.minDaysBeforeStart.
   *  4. If no tier qualifies, return 0.
   */
  resolveRefundPercent(
    tiers: { minDaysBeforeStart: number; refundPercent: number }[],
    bookingDate: Date,
    startTime: string, // "HH:MM"
  ): number {
    if (!tiers || tiers.length === 0) return 0;

    const daysBeforeStart = this.daysBeforeBookingStart(bookingDate, startTime);

    const sorted = [...tiers].sort(
      (a, b) => b.minDaysBeforeStart - a.minDaysBeforeStart,
    );

    const matching = sorted.find(
      (t) => daysBeforeStart >= t.minDaysBeforeStart,
    );

    return matching?.refundPercent ?? 0;
  }

  /**
   * Returns the number of whole calendar days between now (Vietnam UTC+7)
   * and the booking start datetime.
   * Result can be negative (booking already started / in the past).
   */
  private daysBeforeBookingStart(bookingDate: Date, startTime: string): number {
    // bookingDate stored as UTC midnight — extract the date string
    const dateStr = bookingDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
    const bookingStart = new Date(`${dateStr}T${startTime}:00+07:00`);
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((bookingStart.getTime() - now.getTime()) / msPerDay);
  }

  // ─────────────────────────────────────────────────────────────
  // Player credit wallet queries
  // ─────────────────────────────────────────────────────────────

  /**
   * Returns all credit wallets owned by a player (one per sport center).
   * Includes center info and the last transaction (with its booking) for
   * a rich "My Credits" list view.
   */
  async getPlayerWallets(playerId: string) {
    const wallets = await this.prisma.sportCenterCredit.findMany({
      where: { playerId },
      include: {
        center: {
          select: { id: true, name: true, address: true, images: true },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1, // last transaction only — enough for list preview
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Enrich each wallet's last transaction with booking details
    return Promise.all(
      wallets.map(async (wallet) => ({
        ...wallet,
        transactions: await this.enrichTransactions(wallet.transactions),
      })),
    );
  }

  /**
   * Returns the transaction history for a player's wallet at a specific center,
   * with each transaction enriched with its related booking details.
   */
  async getPlayerTransactions(
    playerId: string,
    centerId: string,
    limit: number,
    offset: number,
  ) {
    const wallet = await this.prisma.sportCenterCredit.findUnique({
      where: { playerId_centerId: { playerId, centerId } },
      include: {
        center: { select: { id: true, name: true } },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        },
      },
    });

    if (!wallet) return { balance: 0, transactions: [], center: null };

    return {
      ...wallet,
      transactions: await this.enrichTransactions(wallet.transactions),
    };
  }

  /**
   * Returns only the current credit balance for a player's wallet at a
   * specific sport center. If the wallet does not exist yet, balance is 0.
   */
  async getPlayerBalance(playerId: string, centerId: string) {
    const wallet = await this.prisma.sportCenterCredit.findUnique({
      where: { playerId_centerId: { playerId, centerId } },
      select: { centerId: true, balance: true },
    });

    return {
      centerId,
      balance: wallet ? Number(wallet.balance) : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Given a list of credit transactions, batch-fetches the related booking
   * for each non-null bookingId and merges the details inline.
   * Returns a new array where each transaction has a `booking` field
   * (or null if the transaction has no associated booking).
   */
  private async enrichTransactions(
    transactions: { bookingId?: string | null; [key: string]: any }[],
  ) {
    // Collect unique booking IDs
    const bookingIds = [
      ...new Set(transactions.map((t) => t.bookingId).filter(Boolean) as string[]),
    ];

    if (bookingIds.length === 0) {
      return transactions.map((t) => ({ ...t, booking: null }));
    }

    // Single batch query for all referenced bookings
    const bookings = await this.prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      select: {
        id: true,
        date: true,
        status: true,
        totalPrice: true,
        creditApplied: true,
        paymentRemaining: true,
        center: {
          select: { id: true, name: true },
        },
        bookingItems: {
          select: {
            startTime: true,
            endTime: true,
            itemPrice: true,
            court: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    const bookingMap = new Map(
      bookings.map((b) => {
        const startTimes = b.bookingItems.map((item) => item.startTime).sort();
        const endTimes = b.bookingItems.map((item) => item.endTime).sort();

        return [
          b.id,
          {
            id: b.id,
            date: b.date,
            startTime: startTimes[0] ?? null,
            endTime: endTimes[endTimes.length - 1] ?? null,
            status: b.status,
            totalPrice: b.totalPrice,
            creditApplied: b.creditApplied,
            paymentRemaining: b.paymentRemaining,
            center: b.center,
            bookingItems: b.bookingItems.map((item) => ({
              startTime: item.startTime,
              endTime: item.endTime,
              itemPrice: item.itemPrice,
              court: item.court,
            })),
          },
        ];
      }),
    );

    return transactions.map((t) => ({
      ...t,
      booking: t.bookingId ? (bookingMap.get(t.bookingId) ?? null) : null,
    }));
  }
}

