import { AppError } from '../middleware/errorHandler';
import { prisma } from './prisma';
import {
  paymentGatewayService,
  type PaymentGateway,
  type InitializePaymentParams,
  type InitializePaymentResponse,
  type VerifyPaymentResponse,
  type GatewayCredentialSet,
} from './paymentGateway';


export type TenantPaymentSettingsDoc = {
  tenantId: string;
  defaultGateway?: PaymentGateway;
  currency?: string;
  callbackUrl?: string;
  paystackPublicKey?: string;
  paystackSecretKey?: string;
  flutterwavePublicKey?: string;
  flutterwaveSecretKey?: string;
  flutterwaveSecretHash?: string;
  monnifyApiKey?: string;
  monnifySecretKey?: string;
  monnifyContractCode?: string;
  monnifyCollectionAccount?: string;
  monnifyBaseUrl?: string;
  stripePublicKey?: string;
  stripeSecretKey?: string;
  allowedGateways?: PaymentGateway[];
  updatedAt?: Date;
  createdAt?: Date;
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
  flutterwaveSecretHash?: string;
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
    | 'flutterwaveSecretHash'
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

const readPaymentSettingsDoc = async (
  tenantId: string
): Promise<TenantPaymentSettingsDoc | null> => {
  if (!prisma) {
    return null;
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { paymentSettings: true },
  });
  return (tenant?.paymentSettings as TenantPaymentSettingsDoc | null) ?? null;
};

export const getTenantPaymentSettings = async (tenantId: string): Promise<TenantPaymentSettings> => {
  const doc = await readPaymentSettingsDoc(tenantId);

  const defaultGateway = doc?.defaultGateway ?? DEFAULT_GATEWAY;
  const allowedGateways = (doc?.allowedGateways?.length
    ? doc.allowedGateways
    : [defaultGateway]
  ).filter((gateway) =>
    ['paystack', 'flutterwave', 'stripe', 'monnify'].includes(gateway)
  ) as PaymentGateway[];

  return {
    tenantId,
    defaultGateway,
    currency: doc?.currency ?? DEFAULT_CURRENCY,
    callbackUrl: doc?.callbackUrl ?? (DEFAULT_CALLBACK_URL || undefined),
    paystackPublicKey: doc?.paystackPublicKey ?? process.env.PAYSTACK_PUBLIC_KEY,
    paystackSecretKey: doc?.paystackSecretKey ?? process.env.PAYSTACK_SECRET_KEY,
    flutterwavePublicKey: doc?.flutterwavePublicKey ?? process.env.FLUTTERWAVE_PUBLIC_KEY,
    flutterwaveSecretKey: doc?.flutterwaveSecretKey ?? process.env.FLUTTERWAVE_SECRET_KEY,
    flutterwaveSecretHash:
      doc?.flutterwaveSecretHash ?? process.env.FLUTTERWAVE_SECRET_HASH,
    monnifyApiKey: doc?.monnifyApiKey ?? process.env.MONNIFY_API_KEY,
    monnifySecretKey: doc?.monnifySecretKey ?? process.env.MONNIFY_SECRET_KEY,
    monnifyContractCode: doc?.monnifyContractCode ?? process.env.MONNIFY_CONTRACT_CODE,
    monnifyCollectionAccount: doc?.monnifyCollectionAccount ?? process.env.MONNIFY_COLLECTION_ACCOUNT,
    monnifyBaseUrl: doc?.monnifyBaseUrl ?? process.env.MONNIFY_BASE_URL,
    stripePublicKey: doc?.stripePublicKey ?? process.env.STRIPE_PUBLIC_KEY,
    stripeSecretKey: doc?.stripeSecretKey ?? process.env.STRIPE_SECRET_KEY,
    allowedGateways: allowedGateways.length > 0 ? Array.from(new Set(allowedGateways)) : [defaultGateway],
  };
};

export const upsertTenantPaymentSettings = async (
  tenantId: string,
  updates: TenantPaymentSettingsUpdate
) => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const existing = await readPaymentSettingsDoc(tenantId);
  const merged: TenantPaymentSettingsDoc = {
    ...(existing ?? { tenantId }),
    ...updates,
    tenantId,
    updatedAt: new Date(),
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { paymentSettings: JSON.parse(JSON.stringify(merged)) },
  });

  return merged;
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
    case 'monnify':
      return {
        monnifyApiKey: settings.monnifyApiKey,
        monnifySecretKey: settings.monnifySecretKey,
        monnifyContractCode: settings.monnifyContractCode,
        monnifyBaseUrl: settings.monnifyBaseUrl,
      };
    case 'stripe':
      return {
        stripeSecretKey: settings.stripeSecretKey,
      };
    default:
      return undefined;
  }
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
