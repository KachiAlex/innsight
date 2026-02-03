// import admin from 'firebase-admin';
import { AppError } from '../middleware/errorHandler';
// import { db, now } from './firestore';

export const CHECKOUT_INTENT_COLLECTION = 'public_checkout_intents';

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
  expiresAt: admin.firestore.Timestamp;
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
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
};

export type CheckoutIntentRecord<TBooking = any> = CheckoutIntentDoc<TBooking> & {
  id: string;
};

export const loadCheckoutIntent = async <TBooking = any>(
  intentId: string
): Promise<CheckoutIntentRecord<TBooking>> => {
  const snapshot = await db.collection(CHECKOUT_INTENT_COLLECTION).doc(intentId).get();
  if (!snapshot.exists) {
    throw new AppError('Checkout intent not found', 404);
  }
  return { id: snapshot.id, ...(snapshot.data() as CheckoutIntentDoc<TBooking>) };
};

export const findCheckoutIntentByReference = async <TBooking = any>(
  reference: string
): Promise<CheckoutIntentRecord<TBooking> | null> => {
  const snapshot = await db
    .collection(CHECKOUT_INTENT_COLLECTION)
    .where('reference', '==', reference)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...(doc.data() as CheckoutIntentDoc<TBooking>) };
};

export const markIntentStatus = async (
  intentId: string,
  status: CheckoutIntentDoc['status'],
  updates?: Record<string, any>
) => {
  await db.collection(CHECKOUT_INTENT_COLLECTION).doc(intentId).update({
    status,
    updatedAt: now(),
    ...(updates || {}),
  });
};
