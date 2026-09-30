import { BookingStatus } from '@prisma/client';
import { prisma, getDeterministicId, BOOKER_IDS, MAIN_USER_ID } from './helpers';

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



export async function seedBooking(centerId: string, centerIndex: number) {
  const bookings = [];
  const statuses = [
    BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.COMPLETED,
    BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.CONFIRMED
  ];

  const numBookings = centerIndex === 1 ? 35 : 15;
  for (let i = 1; i <= numBookings; i++) {
    const bookingId = getDeterministicId('booking', centerIndex, i);
    let bookerId = BOOKER_IDS[i % BOOKER_IDS.length];
    let status = statuses[i % statuses.length];
    
    let date = new Date();
    date.setDate(date.getDate() + (i % 5) - 2); // Spread over past/future 2 days
 
    // Specific bookings for social event testing (Center 1)
    if (centerIndex === 1 && i === 10) {
      date = getRelativeDate(10, '00:00:00.000');
      status = BookingStatus.CONFIRMED;
      bookerId = MAIN_USER_ID;
    } else if (centerIndex === 1 && i === 11) {
      date = getRelativeDate(11, '00:00:00.000');
      status = BookingStatus.CONFIRMED;
      bookerId = MAIN_USER_ID;
    } else if (centerIndex === 1 && i === 12) {
      date = getRelativeDate(17, '00:00:00.000'); // Session 3 – next Saturday
      status = BookingStatus.CONFIRMED;
      bookerId = MAIN_USER_ID;
    } else if (centerIndex === 1 && i === 13) {
      date = getRelativeDate(13, '00:00:00.000');
      status = BookingStatus.PENDING;
      bookerId = MAIN_USER_ID;
    } else if (centerIndex === 1 && i === 14) {
      date = getRelativeDate(14, '00:00:00.000');
      status = BookingStatus.CANCELLED;
      bookerId = MAIN_USER_ID;
    } else if (centerIndex === 1 && i >= 16 && i <= 21) {
      date = getRelativeDate(i + 5, '00:00:00.000'); // Spread over early July 2026
      status = BookingStatus.CONFIRMED;
      bookerId = MAIN_USER_ID;
    } else if (centerIndex === 1 && i >= 31 && i <= 35) {
      date = getRelativeDate(35, '00:00:00.000'); // All on day 35
      status = BookingStatus.CONFIRMED;
      bookerId = MAIN_USER_ID;
    }
 
    // Determine totalPrice for special social bookings based on actual court allocations
    let totalPrice = '200000.00';
    if (centerIndex === 1 && i === 10) totalPrice = '300000.00'; // 2 courts × 150k
    if (centerIndex === 1 && i === 11) totalPrice = '300000.00'; // 2 courts × 150k
    if (centerIndex === 1 && i === 12) totalPrice = '450000.00'; // 3 courts × 150k
    if (centerIndex === 1 && i >= 16 && i <= 21) totalPrice = '300000.00'; // 2 courts × 150k
    if (centerIndex === 1 && i >= 31 && i <= 35) totalPrice = '600000.00'; // 4 courts × 150k
 
    const booking = await prisma.booking.upsert({
      where: { id: bookingId },
      update: {
        status,
        playerId: bookerId,
        date,
        createdAt: status === BookingStatus.PENDING ? new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000) : undefined,
      },
      create: {
        id: bookingId,
        centerId,
        playerId: bookerId,
        playerName: `Booker ${i}`,
        phoneNumber: '0901112222',
        date,
        status,
        totalPrice,
        paymentRemaining: status === BookingStatus.PENDING ? totalPrice : '0.00',
        note: `Booking ${i} for center ${centerIndex}`,
        cancelledAt: status === BookingStatus.CANCELLED ? new Date() : null,
        createdAt: status === BookingStatus.PENDING ? new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000) : undefined,
      },
    });
    bookings.push(booking);
  }

  // Special IN_PROGRESS booking
  if (centerIndex === 1) {
    const booking = await prisma.booking.upsert({
      where: { id: 'b0040000-b004-4000-8000-000000010099' },
      update: {
        status: BookingStatus.CONFIRMED,
        playerId: MAIN_USER_ID,
        date: getRelativeDate(7, '00:00:00.000'),
      },
      create: {
        id: 'b0040000-b004-4000-8000-000000010099',
        centerId,
        playerId: MAIN_USER_ID,
        playerName: 'Booker IN_PROGRESS',
        phoneNumber: '0901112222',
        date: getRelativeDate(7, '00:00:00.000'),
        status: BookingStatus.CONFIRMED,
        totalPrice: '300000.00',
        paymentRemaining: '0.00',
        note: 'IN PROGRESS testing booking',
      },
    });
  }

  // Seeding 22 confirmed bookings for tournament service scenarios
  const tournamentBookings = [
    ...Array.from({ length: 12 }, (_, idx) => 101 + idx), // 101 to 112 (Tournament 10101)
    ...Array.from({ length: 6 }, (_, idx) => 120 + idx),  // 120 to 125 (Tournament 10102)
    ...Array.from({ length: 4 }, (_, idx) => 130 + idx)   // 130 to 133 (Tournament 10103)
  ];

  for (const i of tournamentBookings) {
    const bookingId = getDeterministicId('booking', 1, i);
    const bookerId = MAIN_USER_ID;
    const status = BookingStatus.CONFIRMED;
    const date = getRelativeDate(10, '00:00:00.000');
    const totalPrice = i <= 112 ? '300000.00' : '150000.00';

    const booking = await prisma.booking.upsert({
      where: { id: bookingId },
      update: {
        status,
        playerId: bookerId,
        date,
      },
      create: {
        id: bookingId,
        centerId,
        playerId: bookerId,
        playerName: `Tournament Booker ${i}`,
        phoneNumber: '0901112222',
        date,
        status,
        totalPrice,
        paymentRemaining: '0.00',
        note: `Seeded Booking ${i} for Tournament Service`,
      },
    });
    bookings.push(booking);
  }

  return bookings;
}
