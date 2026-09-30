import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Auth Service Accounts
export const MAIN_USER_ID = '11111111-1111-4111-8111-111111111111';
export const OWNER_USER_ID = '22222222-2222-4222-8222-222222222222';
export const BOOKER_IDS = [
  MAIN_USER_ID,
  'b0000001-b000-4000-8000-000000000000',
  'b0000002-b000-4000-8000-000000000000',
  'b0000003-b000-4000-8000-000000000000',
];

export function getDeterministicId(type: string, ...indices: number[]): string {
  const prefixes: Record<string, string> = {
    center: 'c000', court: 'c001', slot: '5107', service: '5e12',
    product: '940d', booking: 'b004', item: '17e1', payment: '9a11',
    credit: 'c12e', review: '1e1e', favourite: 'f000', tier: '71e1',
    creditTransaction: 'c11a', bService: 'b5ec', bProduct: 'b90d'
  };
  const prefix = prefixes[type] || '0000';
  const suffix = indices.map((n) => String(n).padStart(4, '0')).join('');
  const paddedSuffix = suffix.padStart(12, '0');
  return `${prefix}0000-${prefix}-4000-8000-${paddedSuffix}`;
}

export async function safeDisconnect() {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore disconnect failures during shutdown
  }
}
