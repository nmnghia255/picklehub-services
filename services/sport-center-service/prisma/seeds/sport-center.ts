import { SportCenterStatus } from '@prisma/client';
import { OWNER_USER_ID, prisma, getDeterministicId } from './helpers';

export async function seedSportCenter(centerIndex: number) {
  const centerId = getDeterministicId('center', centerIndex);
  const names = ['PickleHub Downtown', 'PickleHub Riverside'];
  const addresses = ['123 Main St, District 1, HCMC', '456 River Ave, District 2, HCMC'];

  const latitudes = [10.7769, 10.7983];
  const longitudes = [106.7009, 106.7324];

  return prisma.sportCenter.upsert({
    where: { id: centerId },
    update: {
      name: names[centerIndex - 1] || `PickleHub Center ${centerIndex}`,
      address: addresses[centerIndex - 1] || 'Unknown Address',
      latitude: latitudes[centerIndex - 1] ?? null,
      longitude: longitudes[centerIndex - 1] ?? null,
    },
    create: {
      id: centerId,
      ownerId: OWNER_USER_ID,
      name: names[centerIndex - 1] || `PickleHub Center ${centerIndex}`,
      address: addresses[centerIndex - 1] || 'Unknown Address',
      latitude: latitudes[centerIndex - 1] ?? null,
      longitude: longitudes[centerIndex - 1] ?? null,
      phone: '0901234567',
      openTime: '06:00',
      closeTime: '22:00',
      basePrice: '150000.00',
      status: SportCenterStatus.ACTIVE,
      amenities: ['Parking', 'Wifi', 'Restroom', 'Cafe'],
      images: ['https://cdn.picklehub.vn/demo/center-1.jpg'],
      rules: ['No smoking inside courts', 'Wear proper non-marking shoes'],
      paymentAccountName: 'NGUYEN VAN OWNER',
      paymentAccountNumber: '0901234567',
      paymentBankName: 'Techcombank',
      paymentQrUrl: 'https://cdn.picklehub.vn/demo/qr-code.png',
      allowCancellation: true,
    },
  });
}
