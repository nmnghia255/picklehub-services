import { prisma, getDeterministicId } from './helpers';

export async function seedCancellationTier(centerId: string, centerIndex: number) {
  const tiers = [
    { minDaysBeforeStart: 3, refundPercent: 100 },
    { minDaysBeforeStart: 2, refundPercent: 50 },
    { minDaysBeforeStart: 1, refundPercent: 10 },
  ];

  for (let i = 1; i <= tiers.length; i++) {
    const tierId = getDeterministicId('tier', centerIndex, i);
    const tier = tiers[i - 1];
    await prisma.cancellationTier.upsert({
      where: { id: tierId },
      update: { refundPercent: tier.refundPercent },
      create: {
        id: tierId,
        centerId,
        minDaysBeforeStart: tier.minDaysBeforeStart,
        refundPercent: tier.refundPercent,
      },
    });
  }
}
