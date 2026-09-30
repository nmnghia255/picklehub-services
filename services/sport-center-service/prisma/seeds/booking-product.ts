import { prisma, getDeterministicId } from './helpers';

export async function seedBookingProduct(bookingId: string, centerIndex: number, bookingIndex: number, products: any[]) {
  if (bookingIndex % 3 !== 0) return; // Only 33% of bookings have products
  const bpId = getDeterministicId('bProduct', centerIndex, bookingIndex);
  const product = products[bookingIndex % products.length];

  await prisma.bookingProduct.upsert({
    where: { id: bpId },
    update: {},
    create: {
      id: bpId,
      bookingId,
      productId: product.id,
      quantity: 3,
      price: product.price,
    },
  });
}
