import { PaymentMethod, PaymentTransactionStatus } from '@prisma/client';
import { prisma, getDeterministicId } from './helpers';

export async function seedPaymentTransaction(booking: any, centerIndex: number, bookingIndex: number) {
  if (booking.status === 'PENDING' || booking.status === 'CANCELLED') return;
  // Skip tournament-seeded bookings — they don't need payment records
  if (booking.note && booking.note.startsWith('Seeded Booking')) return;
  
  const paymentId = getDeterministicId('payment', centerIndex, bookingIndex);

  await prisma.paymentTransaction.upsert({
    where: { id: paymentId },
    update: { bookingId: booking.id },
    create: {
      id: paymentId,
      bookingId: booking.id,
      centerId: booking.centerId,
      playerId: booking.playerId,
      amount: booking.totalPrice,
      method: PaymentMethod.BANK_TRANSFER,
      status: PaymentTransactionStatus.SETTLED,
      proofUrl: 'https://cdn.picklehub.vn/demo/proof.jpg',
      receivedAt: new Date(),
      reviewedAt: new Date(),
    },
  });
}
