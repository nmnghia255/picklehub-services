import { prisma, getDeterministicId, BOOKER_IDS } from './helpers';

export async function seedSportCenterCredit(centerId: string, centerIndex: number) {
  const credits = [];
  for (let i = 1; i <= BOOKER_IDS.length; i++) {
    const creditId = getDeterministicId('credit', centerIndex, i);
    const playerId = BOOKER_IDS[i - 1];
    
    const credit = await prisma.sportCenterCredit.upsert({
      where: { id: creditId },
      update: {},
      create: {
        id: creditId,
        playerId,
        centerId,
        balance: '500000.00',
      },
    });
    credits.push(credit);
  }
  return credits;
}
