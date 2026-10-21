import Paystack from 'paystack';
import Flutterwave from 'flutterwave-node-v3';
import Stripe from 'stripe';
import { AppError } from '../middleware/errorHandler';

export type PaymentGateway = 'paystack' | 'flutterwave' | 'monnify' | 'stripe' | 'manual';

export type GatewayCredentialSet = {
  paystackSecretKey?: string;
  flutterwavePublicKey?: string;
  flutterwaveSecretKey?: string;
  monnifyApiKey?: string;
  monnifySecretKey?: string;
  monnifyContractCode?: string;
  monnifyBaseUrl?: string;
  stripeSecretKey?: string;
};

export interface InitializePaymentParams {
  gateway: PaymentGateway;
  amount: number; // in kobo/cent (smallest currency unit)
  email: string;
  reference?: string;
  metadata?: Record<string, any>;
  callbackUrl?: string;
  currency?: string; // Default: NGN
  customerName?: string;
  customerPhone?: string;
  successUrl?: string;
  cancelUrl?: string;
  credentials?: GatewayCredentialSet;
}

export interface InitializePaymentResponse {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  gateway: PaymentGateway;
}

export interface VerifyPaymentParams {
  gateway: PaymentGateway;
  reference: string;
  credentials?: GatewayCredentialSet;
}

export interface VerifyPaymentResponse {
  status: 'success' | 'failed' | 'pending';
  amount: number;
  currency: string;
  reference: string;
  gatewayTransactionId: string;
  gateway: PaymentGateway;
  paidAt?: Date;
  customer?: {
    email: string;
    name?: string;
    phone?: string;
  };
  metadata?: Record<string, any>;
}

class PaymentGatewayService {
  private paystackClient: Paystack | null = null;
  private flutterwaveClient: Flutterwave | null = null;
  private stripeClient: Stripe | null = null;
  // Monnify bearer tokens keyed by API key (tokens are credential-scoped)
  private monnifyTokens = new Map<string, { token: string; expiresAt: number }>();

  constructor() {
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (paystackSecretKey) {
      this.paystackClient = Paystack(paystackSecretKey);
    }

    const flutterwavePublicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;
    const flutterwaveSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (flutterwavePublicKey && flutterwaveSecretKey) {
      this.flutterwaveClient = new Flutterwave(flutterwavePublicKey, flutterwaveSecretKey);
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (stripeSecretKey) {
      this.stripeClient = new Stripe(stripeSecretKey);
    }
  }

  private getPaystackClient(secretKey?: string) {
    if (secretKey) {
      return Paystack(secretKey);
    }
    if (this.paystackClient) {
      return this.paystackClient;
    }
    throw new AppError('Paystack is not configured. Please set PAYSTACK_SECRET_KEY.', 500);
  }

  private getFlutterwaveClient(publicKey?: string, secretKey?: string) {
    if (publicKey && secretKey) {
      return new Flutterwave(publicKey, secretKey);
    }
    if (this.flutterwaveClient) {
      return this.flutterwaveClient;
    }
    throw new AppError('Flutterwave is not configured. Please set FLUTTERWAVE keys.', 500);
  }

  private getStripeClient(secretKey?: string) {
    if (secretKey) {
      return new Stripe(secretKey);
    }
    if (this.stripeClient) {
      return this.stripeClient;
    }
    throw new AppError('Stripe is not configured. Please set STRIPE_SECRET_KEY.', 500);
  }

  private getMonnifyCredentials(credentials?: GatewayCredentialSet) {
    const apiKey = credentials?.monnifyApiKey || process.env.MONNIFY_API_KEY;
    const secretKey = credentials?.monnifySecretKey || process.env.MONNIFY_SECRET_KEY;
    const contractCode =
      credentials?.monnifyContractCode || process.env.MONNIFY_CONTRACT_CODE;
    const baseUrl =
      credentials?.monnifyBaseUrl ||
      process.env.MONNIFY_BASE_URL ||
      'https://sandbox.monnify.com';

    if (!apiKey || !secretKey || !contractCode) {
      throw new AppError(
        'Monnify is not configured. Please set MONNIFY_API_KEY, MONNIFY_SECRET_KEY and MONNIFY_CONTRACT_CODE.',
        500
      );
    }
    return { apiKey, secretKey, contractCode, baseUrl };
  }

  private async getMonnifyToken(credentials?: GatewayCredentialSet): Promise<string> {
    const { apiKey, secretKey, baseUrl } = this.getMonnifyCredentials(credentials);

    const cached = this.monnifyTokens.get(apiKey);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.token;
    }

    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    const data: any = await response.json().catch(() => null);

    if (!response.ok || !data?.responseBody?.accessToken) {
      throw new AppError(
        `Monnify authentication failed: ${data?.responseMessage || response.status}`,
        502
      );
    }

    const expiresInMs = (data.responseBody.expiresIn ?? 3600) * 1000;
    this.monnifyTokens.set(apiKey, {
      token: data.responseBody.accessToken,
      expiresAt: Date.now() + expiresInMs - 60_000,
    });
    return data.responseBody.accessToken;
  }

  async initializePayment(params: InitializePaymentParams): Promise<InitializePaymentResponse> {
    const { gateway, amount, email, reference, metadata, callbackUrl, currency = 'NGN', customerName, customerPhone } = params;

    // Generate reference if not provided
    const paymentReference = reference || `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    switch (gateway) {
      case 'paystack':
        return this.initializePaystackPayment({
          secretKey: params.credentials?.paystackSecretKey,
          amount,
          email,
          reference: paymentReference,
          metadata,
          callbackUrl,
          currency,
          customerName,
          customerPhone,
        });

      case 'flutterwave':
        return this.initializeFlutterwavePayment({
          publicKey: params.credentials?.flutterwavePublicKey,
          secretKey: params.credentials?.flutterwaveSecretKey,
          amount,
          email,
          reference: paymentReference,
          metadata,
          callbackUrl,
          currency,
          customerName,
          customerPhone,
        });

      case 'monnify':
        return this.initializeMonnifyPayment({
          credentials: params.credentials,
          amount,
          email,
          reference: paymentReference,
          metadata,
          callbackUrl,
          currency,
          customerName,
          customerPhone,
        });

      case 'stripe':
        return this.initializeStripePayment({
          secretKey: params.credentials?.stripeSecretKey,
          amount,
          email,
          reference: paymentReference,
          metadata,
          currency,
          callbackUrl,
          successUrl: params.successUrl,
          cancelUrl: params.cancelUrl,
        });

      case 'manual':
        throw new AppError('Cannot initialize manual payment through gateway', 400);

      default:
        throw new AppError(`Unsupported payment gateway: ${gateway}`, 400);
    }
  }

  private async initializePaystackPayment(params: {
    secretKey?: string;
    amount: number;
    email: string;
    reference: string;
    metadata?: Record<string, any>;
    callbackUrl?: string;
    currency: string;
    customerName?: string;
    customerPhone?: string;
  }): Promise<InitializePaymentResponse> {
    try {
      const client = this.getPaystackClient(params.secretKey);
      const response = await client.transaction.initialize({
        amount: params.amount, // Amount in kobo
        email: params.email,
        reference: params.reference,
        metadata: params.metadata,
        callback_url: params.callbackUrl,
        currency: params.currency,
        ...(params.customerName && { name: params.customerName }),
        ...(params.customerPhone && { phone: params.customerPhone }),
      });

      if (!response.status || !response.data) {
        throw new AppError('Failed to initialize Paystack payment', 500);
      }

      return {
        authorizationUrl: response.data.authorization_url,
        accessCode: response.data.access_code,
        reference: response.data.reference,
        gateway: 'paystack',
      };
    } catch (error: any) {
      console.error('Paystack initialization error:', error);
      throw new AppError(
        `Failed to initialize Paystack payment: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }

  private async initializeFlutterwavePayment(params: {
    publicKey?: string;
    secretKey?: string;
    amount: number;
    email: string;
    reference: string;
    metadata?: Record<string, any>;
    callbackUrl?: string;
    currency: string;
    customerName?: string;
    customerPhone?: string;
  }): Promise<InitializePaymentResponse> {
    try {
      const client = this.getFlutterwaveClient(params.publicKey, params.secretKey);
      const payload = {
        tx_ref: params.reference,
        amount: params.amount / 100, // Flutterwave expects amount in currency unit (not smallest unit)
        currency: params.currency,
        redirect_url: params.callbackUrl || '',
        payment_options: 'card,banktransfer,ussd,mobilemoney',
        customer: {
          email: params.email,
          ...(params.customerName && { name: params.customerName }),
          ...(params.customerPhone && { phone_number: params.customerPhone }),
        },
        customizations: {
          title: 'InnSight Payment',
          description: 'Payment for reservation',
        },
        ...(params.metadata && { meta: params.metadata }),
      };

      const response = await client.Payment.initialize(payload);

      if (response.status !== 'success' || !response.data) {
        throw new AppError('Failed to initialize Flutterwave payment', 500);
      }

      return {
        authorizationUrl: response.data.link,
        accessCode: response.data.flw_ref || '',
        reference: params.reference,
        gateway: 'flutterwave',
      };
    } catch (error: any) {
      console.error('Flutterwave initialization error:', error);
      throw new AppError(
        `Failed to initialize Flutterwave payment: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }

  private async initializeMonnifyPayment(params: {
    credentials?: GatewayCredentialSet;
    amount: number;
    email: string;
    reference: string;
    metadata?: Record<string, any>;
    callbackUrl?: string;
    currency: string;
    customerName?: string;
    customerPhone?: string;
  }): Promise<InitializePaymentResponse> {
    try {
      const { contractCode, baseUrl } = this.getMonnifyCredentials(params.credentials);
      const token = await this.getMonnifyToken(params.credentials);

      const response = await fetch(
        `${baseUrl}/api/v1/merchant/transactions/init-transaction`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: params.amount / 100, // Monnify expects major currency unit (naira)
            customerName: params.customerName || params.email,
            customerEmail: params.email,
            paymentReference: params.reference,
            paymentDescription: 'InnSight reservation payment',
            currencyCode: params.currency,
            contractCode,
            redirectUrl: params.callbackUrl || '',
            paymentMethods: ['CARD', 'ACCOUNT_TRANSFER'],
            ...(params.metadata && { metaData: params.metadata }),
          }),
        }
      );
      const data: any = await response.json().catch(() => null);

      if (!response.ok || !data?.requestSuccessful || !data?.responseBody?.checkoutUrl) {
        throw new AppError(
          `Failed to initialize Monnify payment: ${data?.responseMessage || response.status}`,
          502
        );
      }

      return {
        authorizationUrl: data.responseBody.checkoutUrl,
        accessCode:
          data.responseBody.transactionReference ||
          data.responseBody.paymentReference ||
          params.reference,
        reference: params.reference,
        gateway: 'monnify',
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('Monnify initialization error:', error);
      throw new AppError(
        `Failed to initialize Monnify payment: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }

  private async initializeStripePayment(params: {
    secretKey?: string;
    amount: number;
    email: string;
    reference: string;
    metadata?: Record<string, any>;
    currency: string;
    callbackUrl?: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<InitializePaymentResponse> {
    const stripe = this.getStripeClient(params.secretKey);

    const successUrl = params.successUrl || params.callbackUrl || process.env.PUBLIC_PAYMENT_CALLBACK_URL || `${process.env.PUBLIC_PORTAL_BASE_URL || 'http://67.211.210.8:3061'}/public-checkout/success`;
    const cancelUrl = params.cancelUrl || params.callbackUrl || process.env.PUBLIC_PAYMENT_CALLBACK_URL || successUrl;

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: params.email,
        currency: params.currency?.toLowerCase(),
        line_items: [
          {
            price_data: {
              currency: params.currency?.toLowerCase(),
              unit_amount: params.amount,
              product_data: {
                name: 'Reservation payment',
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          reference: params.reference,
          ...(params.metadata || {}),
        },
      });

      if (!session.url) {
        throw new AppError('Failed to initialize Stripe payment', 500);
      }

      return {
        authorizationUrl: session.url,
        accessCode: session.payment_intent?.toString() || session.id,
        reference: session.id,
        gateway: 'stripe',
      };
    } catch (error: any) {
      console.error('Stripe initialization error:', error);
      throw new AppError(
        `Failed to initialize Stripe payment: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResponse> {
    const { gateway, reference } = params;

    switch (gateway) {
      case 'paystack':
        return this.verifyPaystackPayment(reference, params.credentials?.paystackSecretKey);

      case 'flutterwave':
        return this.verifyFlutterwavePayment(
          reference,
          params.credentials?.flutterwavePublicKey,
          params.credentials?.flutterwaveSecretKey
        );

      case 'monnify':
        return this.verifyMonnifyPayment(reference, params.credentials);

      case 'stripe':
        return this.verifyStripePayment(reference, params.credentials?.stripeSecretKey);

      case 'manual':
        throw new AppError('Cannot verify manual payment through gateway', 400);

      default:
        throw new AppError(`Unsupported payment gateway: ${gateway}`, 400);
    }
  }

  private async verifyPaystackPayment(reference: string, secretKey?: string): Promise<VerifyPaymentResponse> {
    try {
      const client = this.getPaystackClient(secretKey);
      const response = await client.transaction.verify(reference);

      if (!response.status || !response.data) {
        throw new AppError('Failed to verify Paystack payment', 500);
      }

      const data = response.data;

      return {
        status: data.status === 'success' ? 'success' : data.status === 'failed' ? 'failed' : 'pending',
        amount: data.amount, // Amount in kobo
        currency: data.currency || 'NGN',
        reference: data.reference,
        gatewayTransactionId: data.id?.toString() || reference,
        gateway: 'paystack',
        paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
        customer: {
          email: data.customer?.email || '',
          name: data.customer?.first_name && data.customer?.last_name
            ? `${data.customer.first_name} ${data.customer.last_name}`
            : data.customer?.email || undefined,
          phone: data.customer?.phone || undefined,
        },
        metadata: data.metadata || undefined,
      };
    } catch (error: any) {
      console.error('Paystack verification error:', error);
      throw new AppError(
        `Failed to verify Paystack payment: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }

  private async verifyFlutterwavePayment(
    reference: string,
    publicKey?: string,
    secretKey?: string
  ): Promise<VerifyPaymentResponse> {
    try {
      const client = this.getFlutterwaveClient(publicKey, secretKey);
      const response = await client.Transaction.verify({ tx_ref: reference });

      if (response.status !== 'success' || !response.data) {
        throw new AppError('Failed to verify Flutterwave payment', 500);
      }

      const data = response.data;

      return {
        status: data.status === 'successful' ? 'success' : data.status === 'failed' ? 'failed' : 'pending',
        amount: (data.amount || 0) * 100, // Convert to smallest currency unit
        currency: data.currency || 'NGN',
        reference: data.tx_ref || reference,
        gatewayTransactionId: data.id?.toString() || reference,
        gateway: 'flutterwave',
        paidAt: data.created_at ? new Date(data.created_at) : undefined,
        customer: {
          email: data.customer?.email || '',
          name: data.customer?.name || undefined,
          phone: data.customer?.phone_number || undefined,
        },
        metadata: data.meta || undefined,
      };
    } catch (error: any) {
      console.error('Flutterwave verification error:', error);
      throw new AppError(
        `Failed to verify Flutterwave payment: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }

  private async verifyMonnifyPayment(
    reference: string,
    credentials?: GatewayCredentialSet
  ): Promise<VerifyPaymentResponse> {
    try {
      const { baseUrl } = this.getMonnifyCredentials(credentials);
      const token = await this.getMonnifyToken(credentials);

      const response = await fetch(
        `${baseUrl}/api/v2/transactions/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data: any = await response.json().catch(() => null);

      if (!response.ok || !data?.responseBody) {
        throw new AppError(
          `Failed to verify Monnify payment: ${data?.responseMessage || response.status}`,
          502
        );
      }

      const body = data.responseBody;
      const paymentStatus: string = body.paymentStatus || '';
      const status =
        paymentStatus === 'PAID' || paymentStatus === 'OVERPAID'
          ? 'success'
          : ['CANCELLED', 'EXPIRED', 'FAILED', 'REVERSED'].includes(paymentStatus)
            ? 'failed'
            : 'pending';

      return {
        status,
        amount: Math.round((body.amountPaid ?? body.amount ?? 0) * 100), // naira → kobo
        currency: body.currencyCode || 'NGN',
        reference: body.paymentReference || reference,
        gatewayTransactionId: body.transactionReference || reference,
        gateway: 'monnify',
        paidAt: body.paidOn ? new Date(body.paidOn) : undefined,
        customer: {
          email: body.customer?.email || '',
          name: body.customer?.name || undefined,
          phone: body.customer?.phoneNumber || undefined,
        },
        metadata: body.metaData || undefined,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('Monnify verification error:', error);
      throw new AppError(
        `Failed to verify Monnify payment: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }

  private async verifyStripePayment(reference: string, secretKey?: string): Promise<VerifyPaymentResponse> {
    const stripe = this.getStripeClient(secretKey);

    try {
      const session = await stripe.checkout.sessions.retrieve(reference, {
        expand: ['payment_intent'],
      });

      const status = session.status === 'complete' ? 'success' : session.status === 'expired' ? 'failed' : 'pending';
      const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;

      return {
        status,
        amount: session.amount_total || 0,
        currency: (session.currency || 'NGN').toUpperCase(),
        reference: session.id,
        gatewayTransactionId: paymentIntent?.id || session.id,
        gateway: 'stripe',
        paidAt: paymentIntent?.status === 'succeeded' && paymentIntent?.created
          ? new Date(paymentIntent.created * 1000)
          : undefined,
        customer: {
          email: session.customer_email || '',
        },
        metadata: session.metadata || undefined,
      };
    } catch (error: any) {
      console.error('Stripe verification error:', error);
      throw new AppError(
        `Failed to verify Stripe payment: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }

  isGatewayConfigured(gateway: PaymentGateway, credentials?: GatewayCredentialSet): boolean {
    switch (gateway) {
      case 'paystack':
        return Boolean(credentials?.paystackSecretKey || this.paystackClient);
      case 'flutterwave':
        return Boolean(
          (credentials?.flutterwavePublicKey && credentials?.flutterwaveSecretKey) ||
            this.flutterwaveClient
        );
      case 'monnify':
        return Boolean(
          (credentials?.monnifyApiKey &&
            credentials?.monnifySecretKey &&
            credentials?.monnifyContractCode) ||
            (process.env.MONNIFY_API_KEY &&
              process.env.MONNIFY_SECRET_KEY &&
              process.env.MONNIFY_CONTRACT_CODE)
        );
      case 'stripe':
        return Boolean(credentials?.stripeSecretKey || this.stripeClient);
      case 'manual':
        return true; // Always available
      default:
        return false;
    }
  }

  getAvailableGateways(): PaymentGateway[] {
    const gateways: PaymentGateway[] = ['manual']; // Manual is always available

    if (this.paystackClient) {
      gateways.push('paystack');
    }
    if (this.flutterwaveClient) {
      gateways.push('flutterwave');
    }
    if (this.stripeClient) {
      gateways.push('stripe');
    }
    if (this.isGatewayConfigured('monnify')) {
      gateways.push('monnify');
    }

    return gateways;
  }
}

// Export singleton instance
export const paymentGatewayService = new PaymentGatewayService();

