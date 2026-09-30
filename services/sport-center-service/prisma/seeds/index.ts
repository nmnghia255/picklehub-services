import { safeDisconnect } from './helpers';
import { seedSportCenter } from './sport-center';
import { seedCourt } from './court';
import { seedCenterPriceSlot } from './center-price-slot';
import { seedService } from './service';
import { seedProduct } from './product';
import { seedBooking } from './booking';
import { seedBookingItem } from './booking-item';
import { seedBookingService } from './booking-service';
import { seedBookingProduct } from './booking-product';
import { seedPaymentTransaction } from './payment-transaction';
import { seedCancellationTier } from './cancellation-tier';
import { seedSportCenterCredit } from './sport-center-credit';
import { seedCreditTransaction } from './credit-transaction';
import { seedReview } from './review';
import { seedFavourite } from './favourite';

export async function main() {
  console.log('Seeding sport-center-service extended demo data...');

  for (let centerIndex = 1; centerIndex <= 2; centerIndex++) {
    const center = await seedSportCenter(centerIndex);
    const courts = await seedCourt(center.id, centerIndex);
    await seedCenterPriceSlot(center.id, centerIndex);
    const services = await seedService(center.id, centerIndex);
    const products = await seedProduct(center.id, centerIndex);
    
    const bookings = await seedBooking(center.id, centerIndex);
    const credits = await seedSportCenterCredit(center.id, centerIndex);

    for (let i = 0; i < bookings.length; i++) {
      const booking = bookings[i];
      const bookingIndex = i + 1;
      
      await seedBookingItem(booking.id, centerIndex, bookingIndex, courts);
      await seedBookingService(booking.id, centerIndex, bookingIndex, services);
      await seedBookingProduct(booking.id, centerIndex, bookingIndex, products);
      
      await seedPaymentTransaction(booking, centerIndex, bookingIndex);

      if (booking.status === 'CANCELLED') {
        const credit = credits.find(c => c.playerId === booking.playerId) || credits[0];
        await seedCreditTransaction(credit.id, booking.id, centerIndex, bookingIndex);
      }
    }

    await seedCancellationTier(center.id, centerIndex);
    await seedReview(center.id, centerIndex);
    await seedFavourite(center.id, centerIndex);
    
    console.log(`Seeded Center ${centerIndex} successfully.`);
  }

  console.log('Sport-center expanded seed complete.');
}

if (require.main === module) {
  main()
    .then(() => safeDisconnect())
    .catch(async (err) => {
      console.error('Failed to seed', err);
      await safeDisconnect();
      process.exit(1);
    });
}
