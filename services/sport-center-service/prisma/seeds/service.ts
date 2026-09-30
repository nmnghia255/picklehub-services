import { ServiceType } from '@prisma/client';
import { prisma, getDeterministicId } from './helpers';

export async function seedService(centerId: string, centerIndex: number) {
  const servicesData = [
    { name: 'Standard Paddle Rental', type: ServiceType.EQUIPMENT_RENTAL, price: '50000.00', unit: 'session' },
    { name: 'Pro Paddle Rental', type: ServiceType.EQUIPMENT_RENTAL, price: '80000.00', unit: 'session' },
    { name: '1-on-1 Coaching', type: ServiceType.COACHING, price: '300000.00', unit: 'hour' },
    { name: 'Group Coaching', type: ServiceType.COACHING, price: '150000.00', unit: 'hour/person' },
    { name: 'Ball Machine Rental', type: ServiceType.FACILITY_ADD_ON, price: '100000.00', unit: 'hour' },
  ];

  const createdServices = [];
  for (let i = 1; i <= servicesData.length; i++) {
    const s = servicesData[i - 1];
    const serviceId = getDeterministicId('service', centerIndex, i);
    const srv = await prisma.service.upsert({
      where: { id: serviceId },
      update: { name: s.name, price: s.price },
      create: {
        id: serviceId,
        centerId,
        name: s.name,
        type: s.type,
        price: s.price,
        unit: s.unit,
        isActive: true,
      },
    });
    createdServices.push(srv);
  }
  return createdServices;
}
