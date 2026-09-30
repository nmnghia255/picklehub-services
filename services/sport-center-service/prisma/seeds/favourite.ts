import { prisma, getDeterministicId, BOOKER_IDS } from './helpers';

export async function seedFavourite(centerId: string, centerIndex: number) {
  for (let i = 1; i <= 3; i++) {
    const favId = getDeterministicId('favourite', centerIndex, i);
    const userId = BOOKER_IDS[i % BOOKER_IDS.length];

    await prisma.favourite.upsert({
      where: { id: favId },
      update: {},
      create: {
        id: favId,
        centerId,
        userId,
      },
    });
  }
}
