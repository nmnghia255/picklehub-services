import { prisma, getDeterministicId, BOOKER_IDS } from './helpers';

export async function seedReview(centerId: string, centerIndex: number) {
  for (let i = 1; i <= 5; i++) {
    const reviewId = getDeterministicId('review', centerIndex, i);
    const userId = BOOKER_IDS[i % BOOKER_IDS.length];

    await prisma.review.upsert({
      where: { id: reviewId },
      update: { rating: 5 },
      create: {
        id: reviewId,
        centerId,
        userId,
        rating: 4 + (i % 2), // 4 or 5
        comment: 'Great facilities and friendly staff!',
      },
    });
  }
}
