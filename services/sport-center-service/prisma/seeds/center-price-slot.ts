import { prisma, getDeterministicId } from './helpers';

export async function seedCenterPriceSlot(centerId: string, centerIndex: number) {
  const slots = [
    { start: '06:00', end: '10:00', price: '120000.00' },
    { start: '10:00', end: '16:00', price: '100000.00' },
    { start: '16:00', end: '22:00', price: '180000.00' },
  ];

  for (let i = 1; i <= slots.length; i++) {
    const slotId = getDeterministicId('slot', centerIndex, i);
    const s = slots[i - 1];
    await prisma.centerPriceSlot.upsert({
      where: { id: slotId },
      update: {
        startTime: s.start,
        endTime: s.end,
        pricePerHour: s.price,
      },
      create: {
        id: slotId,
        centerId,
        startTime: s.start,
        endTime: s.end,
        pricePerHour: s.price,
      },
    });
  }
}
