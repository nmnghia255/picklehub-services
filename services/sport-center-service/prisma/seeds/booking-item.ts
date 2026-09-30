
// Helper to get a relative date while preserving the exact time of day
const getRelativeDate = (daysOffset: number, timeString: string) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysOffset);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return new Date(yyyy + '-' + mm + '-' + dd + 'T' + timeString + 'Z');
};

const getRelativeDateString = (daysOffset: number, timeString: string) => {
  return getRelativeDate(daysOffset, timeString).toISOString();
};

import { prisma, getDeterministicId } from './helpers';

export async function seedBookingItem(bookingId: string, centerIndex: number, bookingIndex: number, courts: any[]) {
  if (centerIndex === 1 && bookingIndex >= 101 && bookingIndex <= 112) {
    // 2 courts (Court A, B) from 08:00 to 10:00
    const item1Id = getDeterministicId('item', centerIndex, bookingIndex * 100 + 1);
    const item2Id = getDeterministicId('item', centerIndex, bookingIndex * 100 + 2);
    await prisma.bookingItem.upsert({
      where: { id: item1Id },
      update: { startTime: '08:00', endTime: '10:00' },
      create: { id: item1Id, bookingId, courtId: courts[0].id, startTime: '08:00', endTime: '10:00', itemPrice: '150000.00' },
    });
    await prisma.bookingItem.upsert({
      where: { id: item2Id },
      update: { startTime: '08:00', endTime: '10:00' },
      create: { id: item2Id, bookingId, courtId: courts[1].id, startTime: '08:00', endTime: '10:00', itemPrice: '150000.00' },
    });
    return;
  }

  if (centerIndex === 1 && ((bookingIndex >= 120 && bookingIndex <= 125) || (bookingIndex >= 130 && bookingIndex <= 133))) {
    // 1 court (Court A) from 08:00 to 10:00
    const itemId = getDeterministicId('item', centerIndex, bookingIndex * 100 + 1);
    await prisma.bookingItem.upsert({
      where: { id: itemId },
      update: { startTime: '08:00', endTime: '10:00' },
      create: { id: itemId, bookingId, courtId: courts[0].id, startTime: '08:00', endTime: '10:00', itemPrice: '150000.00' },
    });
    return;
  }

  if (bookingId === 'b0040000-b004-4000-8000-000000010099') {
    const item1Id = getDeterministicId('item', centerIndex, 9901);
    const item2Id = getDeterministicId('item', centerIndex, 9902);

    await prisma.bookingItem.upsert({
      where: { id: item1Id },
      update: { startTime: '00:00', endTime: '02:00' }, // Matches the event-service times! 00:00Z -> 07:00 VN
      create: {
        id: item1Id,
        bookingId,
        courtId: courts[0].id,
        startTime: '00:00',
        endTime: '02:00',
        itemPrice: '150000.00',
      },
    });

    await prisma.bookingItem.upsert({
      where: { id: item2Id },
      update: { startTime: '00:00', endTime: '02:00' },
      create: {
        id: item2Id,
        bookingId,
        courtId: courts[1].id,
        startTime: '00:00',
        endTime: '02:00',
        itemPrice: '150000.00',
      },
    });
    return;
  }

  if (centerIndex === 1 && (bookingIndex === 10 || bookingIndex === 11)) {
    // Special bookings for social session 1 & 2 testing
    // We book 2 courts: Court A (index 0) and Court B (index 1) from 07:00 to 09:00
    const item1Id = getDeterministicId('item', centerIndex, bookingIndex * 100 + 1);
    const item2Id = getDeterministicId('item', centerIndex, bookingIndex * 100 + 2);
    
    await prisma.bookingItem.upsert({
      where: { id: item1Id },
      update: { startTime: '07:00', endTime: '09:00' },
      create: {
        id: item1Id,
        bookingId,
        courtId: courts[0].id, // Court A
        startTime: '07:00',
        endTime: '09:00',
        itemPrice: '150000.00',
      },
    });

    await prisma.bookingItem.upsert({
      where: { id: item2Id },
      update: { startTime: '07:00', endTime: '09:00' },
      create: {
        id: item2Id,
        bookingId,
        courtId: courts[1].id, // Court B
        startTime: '07:00',
        endTime: '09:00',
        itemPrice: '150000.00',
      },
    });
    return;
  }

  if (centerIndex === 1 && bookingIndex >= 16 && bookingIndex <= 21) {
    // Bookings 16-21: 2 courts (Court A, B) from 08:00 to 10:00
    const item1Id = getDeterministicId('item', centerIndex, bookingIndex * 100 + 1);
    const item2Id = getDeterministicId('item', centerIndex, bookingIndex * 100 + 2);

    await prisma.bookingItem.upsert({
      where: { id: item1Id },
      update: { startTime: '08:00', endTime: '10:00' },
      create: {
        id: item1Id,
        bookingId,
        courtId: courts[0].id, // Court A
        startTime: '08:00',
        endTime: '10:00',
        itemPrice: '150000.00',
      },
    });

    await prisma.bookingItem.upsert({
      where: { id: item2Id },
      update: { startTime: '08:00', endTime: '10:00' },
      create: {
        id: item2Id,
        bookingId,
        courtId: courts[1].id, // Court B
        startTime: '08:00',
        endTime: '10:00',
        itemPrice: '150000.00',
      },
    });
    return;
  }

  if (centerIndex === 1 && bookingIndex === 12) {
    // Session 3 – next Saturday: 3 courts (Court A, B, C) from 07:00 to 09:00
    const item1Id = getDeterministicId('item', centerIndex, 1201);
    const item2Id = getDeterministicId('item', centerIndex, 1202);
    const item3Id = getDeterministicId('item', centerIndex, 1203);

    await prisma.bookingItem.upsert({
      where: { id: item1Id },
      update: { startTime: '07:00', endTime: '09:00' },
      create: { id: item1Id, bookingId, courtId: courts[0].id, startTime: '07:00', endTime: '09:00', itemPrice: '150000.00' },
    });
    await prisma.bookingItem.upsert({
      where: { id: item2Id },
      update: { startTime: '07:00', endTime: '09:00' },
      create: { id: item2Id, bookingId, courtId: courts[1].id, startTime: '07:00', endTime: '09:00', itemPrice: '150000.00' },
    });
    await prisma.bookingItem.upsert({
      where: { id: item3Id },
      update: { startTime: '07:00', endTime: '09:00' },
      create: { id: item3Id, bookingId, courtId: courts[2].id, startTime: '07:00', endTime: '09:00', itemPrice: '150000.00' },
    });
    return;
  }

  if (centerIndex === 1 && bookingIndex >= 31 && bookingIndex <= 35) {
    const item1Id = getDeterministicId('item', centerIndex, bookingIndex * 100 + 1);
    const item2Id = getDeterministicId('item', centerIndex, bookingIndex * 100 + 2);
    const item3Id = getDeterministicId('item', centerIndex, bookingIndex * 100 + 3);
    const item4Id = getDeterministicId('item', centerIndex, bookingIndex * 100 + 4);

    const startHour = (bookingIndex - 31) * 2; // 0, 2, 4, 6, 8
    const endHour = startHour + 2;
    const startStr = startHour.toString().padStart(2, '0') + ':00';
    const endStr = endHour.toString().padStart(2, '0') + ':00';

    const createItem = async (id: string, courtIndex: number) => prisma.bookingItem.upsert({
      where: { id },
      update: { startTime: startStr, endTime: endStr },
      create: {
        id, bookingId, courtId: courts[courtIndex].id, startTime: startStr, endTime: endStr, itemPrice: '150000.00',
      },
    });

    await createItem(item1Id, 0);
    await createItem(item2Id, 1);
    await createItem(item3Id, 2);
    await createItem(item4Id, 3);
    return;
  }

  const itemId = getDeterministicId('item', centerIndex, bookingIndex);
  const court = courts[bookingIndex % courts.length];
  
  await prisma.bookingItem.upsert({
    where: { id: itemId },
    update: {},
    create: {
      id: itemId,
      bookingId,
      courtId: court.id,
      startTime: '08:00',
      endTime: '10:00',
      itemPrice: '150000.00',
    },
  });
}
