// Checkout intents feature uses Firebase for storage
// This needs to be migrated to PostgreSQL via Prisma
// TODO: Implement checkout intents using Prisma/PostgreSQL

import { AppError } from '../middleware/errorHandler';

export const CHECKOUT_INTENT_COLLECTION = 'checkout_intents';

export type PricingSummary = {
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
  createdAt: Date;
  updatedAt: Date;
};

export type CheckoutIntentRecord<TBooking = any> = CheckoutIntentDoc<TBooking> & {
  id: string;
};

export const loadCheckoutIntent = async <TBooking = any>(
  intentId: string
): Promise<CheckoutIntentRecord<TBooking>> => {
  throw new Error('loadCheckoutIntent is not yet implemented for PostgreSQL');
};

export const findCheckoutIntentByReference = async <TBooking = any>(
  reference: string
): Promise<CheckoutIntentRecord<TBooking> | null> => {
  throw new Error('findCheckoutIntentByReference is not yet implemented for PostgreSQL');
};

export const markIntentStatus = async (
  intentId: string,
  status: CheckoutIntentDoc['status'],
  updates?: Record<string, any>
) => {
  throw new Error('markIntentStatus is not yet implemented for PostgreSQL');
};
