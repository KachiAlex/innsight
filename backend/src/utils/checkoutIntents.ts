// Checkout intents stored in PostgreSQL via Prisma (checkout_intents table)

import { AppError } from '../middleware/errorHandler';
import { prisma } from './prisma';

export const CHECKOUT_INTENT_COLLECTION = 'checkout_intents';

export type PricingSummary = {
  effectiveRate: number;
  nights: number;
  totalRoomAmount: number;
};

export type CheckoutIntentDoc<TBooking = any> = {
  tenantId: string;
  slug: string;
  status: 'pending' | 'confirmed' | 'failed' | 'expired' | 'cancelled';
  booking: TBooking;
  pricing: PricingSummary;
  gateway: 'paystack' | 'flutterwave' | 'stripe';
  currency: string;
  amountMajor: number;
  amountMinor: number;
  payDepositOnly: boolean;
  reference: string;
  authorizationUrl: string;
  accessCode: string;
  expiresAt: Date;
  guest: {
    name: string;
    email: string;
    phone?: string | null;
  };
  roomSnapshot: {
    id: string;
    roomNumber: string | null;
    roomType: string | null;
  };
  sessionToken?: string | null;
  reservationId?: string;
  folioId?: string;
  paymentDocumentId?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CheckoutIntentRecord<TBooking = any> = CheckoutIntentDoc<TBooking> & {
  id: string;
};

const toRecord = <TBooking = any>(row: any): CheckoutIntentRecord<TBooking> => ({
  ...row,
  amountMajor: row.amountMajor !== null && row.amountMajor !== undefined
    ? Number(row.amountMajor)
    : row.amountMajor,
});

const requirePrisma = () => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }
  return prisma;
};

const UPDATABLE_FIELDS = [
  'authorizationUrl',
  'accessCode',
  'sessionToken',
  'reservationId',
  'folioId',
  'paymentDocumentId',
  'failureReason',
] as const;

export const loadCheckoutIntent = async <TBooking = any>(
  intentId: string
): Promise<CheckoutIntentRecord<TBooking>> => {
  const client = requirePrisma();
  const row = await client.checkoutIntent.findUnique({
    where: { id: intentId },
  });

  if (!row) {
    throw new AppError('Checkout intent not found', 404);
  }

  if (row.status === 'pending' && row.expiresAt < new Date()) {
    await markIntentStatus(row.id, 'expired');
    throw new AppError('Checkout intent has expired', 410);
  }

  return toRecord<TBooking>(row);
};

export const findCheckoutIntentByReference = async <TBooking = any>(
  reference: string
): Promise<CheckoutIntentRecord<TBooking> | null> => {
  const client = requirePrisma();
  const row = await client.checkoutIntent.findUnique({
    where: { reference },
  });
  return row ? toRecord<TBooking>(row) : null;
};

export const markIntentStatus = async (
  intentId: string,
  status: CheckoutIntentDoc['status'],
  updates?: Record<string, any>
) => {
  const client = requirePrisma();

  const data: Record<string, any> = { status };
  if (updates) {
    for (const key of UPDATABLE_FIELDS) {
      if (key in updates) {
        data[key] = updates[key];
      }
    }
  }

  const row = await client.checkoutIntent.update({
    where: { id: intentId },
    data,
  });

  return toRecord(row);
};
