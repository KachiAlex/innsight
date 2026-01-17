import Paystack from 'paystack';
import Flutterwave from 'flutterwave-node-v3';
import Stripe from 'stripe';
import { AppError } from '../middleware/errorHandler';

export type PaymentGateway = 'paystack' | 'flutterwave' | 'monnify' | 'stripe' | 'manual';

export type GatewayCredentialSet = {
  paystackSecretKey?: string;
  flutterwavePublicKey?: string;
  flutterwaveSecretKey?: string;
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
        throw new AppError('Monnify integration not yet implemented', 501);

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

    const successUrl = params.successUrl || params.callbackUrl || process.env.PUBLIC_PAYMENT_CALLBACK_URL || 'https://innsight-2025.web.app/public-checkout/success';
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
        return false;
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

    return gateways;
  }
}

// Export singleton instance
export const paymentGatewayService = new PaymentGatewayService();

