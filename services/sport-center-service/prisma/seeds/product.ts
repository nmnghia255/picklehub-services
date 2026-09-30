import { ProductType } from '@prisma/client';
import { prisma, getDeterministicId } from './helpers';

export async function seedProduct(centerId: string, centerIndex: number) {
  const productsData = [
    { name: 'Bottled Water', type: ProductType.BEVERAGE, price: '10000.00', unit: 'bottle', stock: 100 },
    { name: 'Energy Drink', type: ProductType.BEVERAGE, price: '25000.00', unit: 'can', stock: 50 },
    { name: 'Overgrip', type: ProductType.EQUIPMENT, price: '30000.00', unit: 'piece', stock: 30 },
    { name: 'Pickleball (3-pack)', type: ProductType.EQUIPMENT, price: '150000.00', unit: 'pack', stock: 20 },
    { name: 'Cooling Towel', type: ProductType.CLOTHING, price: '80000.00', unit: 'piece', stock: 15 },
  ];

  const createdProducts = [];
  for (let i = 1; i <= productsData.length; i++) {
    const p = productsData[i - 1];
    const productId = getDeterministicId('product', centerIndex, i);
    const prod = await prisma.product.upsert({
      where: { id: productId },
      update: { name: p.name, price: p.price, stock: p.stock },
      create: {
        id: productId,
        centerId,
        name: p.name,
        type: p.type,
        price: p.price,
        unit: p.unit,
        stock: p.stock,
        isActive: true,
      },
    });
    createdProducts.push(prod);
  }
  return createdProducts;
}
