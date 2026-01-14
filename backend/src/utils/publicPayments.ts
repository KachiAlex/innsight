import admin from 'firebase-admin';
import { db } from './firestore';
import { AppError } from '../middleware/errorHandler';
import {
  paymentGatewayService,
  type PaymentGateway,
  type InitializePaymentParams,
  type InitializePaymentResponse,
  type VerifyPaymentResponse,
} from './paymentGateway';

export const PAYMENT_SETTINGS_COLLECTION = 'tenant_payment_settings';

export type TenantPaymentSettingsDoc = {
  tenantId: string;
  defaultGateway?: PaymentGateway;
  currency?: string;
  callbackUrl?: string;
  paystackPublicKey?: string;
  paystackSecretKey?: string;
  flutterwavePublicKey?: string;
  flutterwaveSecretKey?: string;
  monnifyApiKey?: string;
  monnifySecretKey?: string;
  monnifyContractCode?: string;
  monnifyCollectionAccount?: string;
  monnifyBaseUrl?: string;
  updatedAt?: FirebaseFirestore.Timestamp;
  createdAt?: FirebaseFirestore.Timestamp;
};

export type TenantPaymentSettings = {
  tenantId: string;
  defaultGateway: PaymentGateway;
  currency: string;
  callbackUrl?: string;
  paystackPublicKey?: string;
  paystackSecretKey?: string;
  flutterwavePublicKey?: string;
  flutterwaveSecretKey?: string;
  monnifyApiKey?: string;
  monnifySecretKey?: string;
  monnifyContractCode?: string;
  monnifyCollectionAccount?: string;
  monnifyBaseUrl?: string;
};

export type TenantPaymentSettingsUpdate = Partial<
  Pick<
    TenantPaymentSettingsDoc,
    | 'defaultGateway'
    | 'currency'
    | 'callbackUrl'
    | 'paystackPublicKey'
    | 'paystackSecretKey'
    | 'flutterwavePublicKey'
    | 'flutterwaveSecretKey'
    | 'monnifyApiKey'
    | 'monnifySecretKey'
    | 'monnifyContractCode'
    | 'monnifyCollectionAccount'
    | 'monnifyBaseUrl'
  >
>;

const DEFAULT_GATEWAY = (process.env.PUBLIC_PAYMENT_DEFAULT_GATEWAY || 'paystack') as PaymentGateway;
const DEFAULT_CURRENCY = process.env.PUBLIC_PAYMENT_DEFAULT_CURRENCY || 'NGN';
const DEFAULT_CALLBACK_URL = process.env.PUBLIC_PAYMENT_CALLBACK_URL;

export const getTenantPaymentSettingsDoc = (tenantId: string) =>
  db.collection(PAYMENT_SETTINGS_COLLECTION).doc(tenantId);

export const getTenantPaymentSettings = async (tenantId: string): Promise<TenantPaymentSettings> => {
  const doc = await getTenantPaymentSettingsDoc(tenantId).get();
  const data = doc.exists ? (doc.data() as TenantPaymentSettingsDoc) : undefined;

  return {
    tenantId,
    defaultGateway: (data?.defaultGateway || DEFAULT_GATEWAY) as PaymentGateway,
    currency: data?.currency || DEFAULT_CURRENCY,
    callbackUrl: data?.callbackUrl || DEFAULT_CALLBACK_URL || undefined,
    paystackPublicKey: data?.paystackPublicKey || process.env.PAYSTACK_PUBLIC_KEY,
    paystackSecretKey: data?.paystackSecretKey || process.env.PAYSTACK_SECRET_KEY,
    flutterwavePublicKey: data?.flutterwavePublicKey || process.env.FLUTTERWAVE_PUBLIC_KEY,
    flutterwaveSecretKey: data?.flutterwaveSecretKey || process.env.FLUTTERWAVE_SECRET_KEY,
    monnifyApiKey: data?.monnifyApiKey || process.env.MONNIFY_API_KEY,
    monnifySecretKey: data?.monnifySecretKey || process.env.MONNIFY_SECRET_KEY,
    monnifyContractCode: data?.monnifyContractCode || process.env.MONNIFY_CONTRACT_CODE,
    monnifyCollectionAccount: data?.monnifyCollectionAccount || process.env.MONNIFY_COLLECTION_ACCOUNT,
    monnifyBaseUrl: data?.monnifyBaseUrl || process.env.MONNIFY_BASE_URL,
  };
};

export const upsertTenantPaymentSettings = async (
  tenantId: string,
  updates: TenantPaymentSettingsUpdate
) => {
  const docRef = getTenantPaymentSettingsDoc(tenantId);
  const payload: TenantPaymentSettingsUpdate & { updatedAt: FirebaseFirestore.Timestamp } = {
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp() as FirebaseFirestore.Timestamp,
  };

  await docRef.set(
    {
      tenantId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      ...payload,
    },
    { merge: true }
  );

  return getTenantPaymentSettings(tenantId);
};

export const ensureGatewayConfigured = (gateway: PaymentGateway) => {
  if (!paymentGatewayService.isGatewayConfigured(gateway)) {
    throw new AppError(
      `${gateway} is not configured. Please set the corresponding environment variables or tenant payment settings.`,
      400
    );
  }
};

export const initializeGatewayPayment = async (
  params: InitializePaymentParams
): Promise<InitializePaymentResponse> => {
  ensureGatewayConfigured(params.gateway);
  return paymentGatewayService.initializePayment(params);
};

export const verifyGatewayPayment = async (
  gateway: PaymentGateway,
  reference: string
): Promise<VerifyPaymentResponse> => {
  ensureGatewayConfigured(gateway);
  return paymentGatewayService.verifyPayment({ gateway, reference });
};
