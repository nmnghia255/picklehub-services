import { CourtStatus, CourtType } from '@prisma/client';
import { prisma, getDeterministicId } from './helpers';

export async function seedCourt(centerId: string, centerIndex: number) {
  const courts = [];
  const letters = ['A', 'B', 'C', 'D'];

  for (let i = 1; i <= 4; i++) {
    const courtId = getDeterministicId('court', centerIndex, i);
    const court = await prisma.court.upsert({
      where: { id: courtId },
      update: {},
      create: {
        id: courtId,
        centerId,
        name: `Court ${letters[i - 1]}`,
        type: i > 2 ? CourtType.OUTDOOR : CourtType.INDOOR,
        status: CourtStatus.ACTIVE,
      },
    });
    courts.push(court);
  }
  return courts;
}
