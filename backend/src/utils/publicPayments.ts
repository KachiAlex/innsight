import admin from 'firebase-admin';
import { db } from './firestore';
import { AppError } from '../middleware/errorHandler';
import {
  paymentGatewayService,
  type PaymentGateway,
  type InitializePaymentParams,
  type InitializePaymentResponse,
  type VerifyPaymentResponse,
  type GatewayCredentialSet,
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
  stripePublicKey?: string;
  stripeSecretKey?: string;
  allowedGateways?: PaymentGateway[];
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
  stripePublicKey?: string;
  stripeSecretKey?: string;
  allowedGateways: PaymentGateway[];
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
    | 'stripePublicKey'
    | 'stripeSecretKey'
    | 'allowedGateways'
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

  const defaultGateway = (data?.defaultGateway || DEFAULT_GATEWAY) as PaymentGateway;
  const allowedGateways = (data?.allowedGateways && data.allowedGateways.length > 0
    ? data.allowedGateways
    : [defaultGateway]
  ).filter((gateway) => ['paystack', 'flutterwave', 'stripe'].includes(gateway)) as PaymentGateway[];

  return {
    tenantId,
    defaultGateway,
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
    stripePublicKey: data?.stripePublicKey || process.env.STRIPE_PUBLIC_KEY,
    stripeSecretKey: data?.stripeSecretKey || process.env.STRIPE_SECRET_KEY,
    allowedGateways: allowedGateways.length > 0 ? Array.from(new Set(allowedGateways)) : [defaultGateway],
  };
};

export const buildGatewayCredentialSet = (
  settings: TenantPaymentSettings,
  gateway: PaymentGateway
): GatewayCredentialSet | undefined => {
  switch (gateway) {
    case 'paystack':
      return {
        paystackSecretKey: settings.paystackSecretKey,
      };
    case 'flutterwave':
      return {
        flutterwavePublicKey: settings.flutterwavePublicKey,
        flutterwaveSecretKey: settings.flutterwaveSecretKey,
      };
    case 'stripe':
      return {
        stripeSecretKey: settings.stripeSecretKey,
      };
    default:
      return undefined;
  }
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

export const ensureGatewayConfigured = (
  gateway: PaymentGateway,
  credentials?: GatewayCredentialSet
) => {
  if (!paymentGatewayService.isGatewayConfigured(gateway, credentials)) {
    throw new AppError(
      `${gateway} is not configured. Please set the corresponding environment variables or tenant payment settings.`,
      400
    );
  }
};

export const initializeGatewayPayment = async (
  params: InitializePaymentParams
): Promise<InitializePaymentResponse> => {
  ensureGatewayConfigured(params.gateway, params.credentials);
  return paymentGatewayService.initializePayment(params);
};

export const verifyGatewayPayment = async (
  gateway: PaymentGateway,
  reference: string,
  credentials?: GatewayCredentialSet
): Promise<VerifyPaymentResponse> => {
  ensureGatewayConfigured(gateway, credentials);
  return paymentGatewayService.verifyPayment({ gateway, reference, credentials });
};
