import { CreditTransactionType } from '@prisma/client';
import { prisma, getDeterministicId } from './helpers';

export async function seedCreditTransaction(creditId: string, bookingId: string, centerIndex: number, bookingIndex: number) {
  const txId = getDeterministicId('creditTransaction', centerIndex, bookingIndex);

  await prisma.creditTransaction.upsert({
    where: { id: txId },
    update: {},
    create: {
      id: txId,
      creditId,
      bookingId,
      amount: '200000.00',
      type: CreditTransactionType.CANCELLATION_REFUND,
      description: 'Seed credit refund for cancelled booking',
    },
  });
}
