import { prisma, getDeterministicId } from './helpers';

export async function seedBookingService(bookingId: string, centerIndex: number, bookingIndex: number, services: any[]) {
  if (bookingIndex % 2 !== 0) return; // Only 50% of bookings have services
  const bsId = getDeterministicId('bService', centerIndex, bookingIndex);
  const service = services[bookingIndex % services.length];

  await prisma.bookingService.upsert({
    where: { id: bsId },
    update: {},
    create: {
      id: bsId,
      bookingId,
      serviceId: service.id,
      quantity: 2,
      price: service.price,
    },
  });
}
