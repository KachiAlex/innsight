import Paystack from 'paystack';
import Flutterwave from 'flutterwave-node-v3';
import { AppError } from '../middleware/errorHandler';

export type PaymentGateway = 'paystack' | 'flutterwave' | 'monnify' | 'stripe' | 'manual';

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

  constructor() {
    // Initialize Paystack
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (paystackSecretKey) {
      this.paystackClient = Paystack(paystackSecretKey);
    }

    // Initialize Flutterwave
    const flutterwavePublicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;
    const flutterwaveSecretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (flutterwavePublicKey && flutterwaveSecretKey) {
      this.flutterwaveClient = new Flutterwave(flutterwavePublicKey, flutterwaveSecretKey);
    }
  }

  async initializePayment(params: InitializePaymentParams): Promise<InitializePaymentResponse> {
    const { gateway, amount, email, reference, metadata, callbackUrl, currency = 'NGN', customerName, customerPhone } = params;

    // Generate reference if not provided
    const paymentReference = reference || `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    switch (gateway) {
      case 'paystack':
        return this.initializePaystackPayment({
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
        throw new AppError('Stripe integration not yet implemented', 501);

      case 'manual':
        throw new AppError('Cannot initialize manual payment through gateway', 400);

      default:
        throw new AppError(`Unsupported payment gateway: ${gateway}`, 400);
    }
  }

  private async initializePaystackPayment(params: {
    amount: number;
    email: string;
    reference: string;
    metadata?: Record<string, any>;
    callbackUrl?: string;
    currency: string;
    customerName?: string;
    customerPhone?: string;
  }): Promise<InitializePaymentResponse> {
    if (!this.paystackClient) {
      throw new AppError('Paystack is not configured. Please set PAYSTACK_SECRET_KEY', 500);
    }

    try {
      const response = await this.paystackClient.transaction.initialize({
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
    amount: number;
    email: string;
    reference: string;
    metadata?: Record<string, any>;
    callbackUrl?: string;
    currency: string;
    customerName?: string;
    customerPhone?: string;
  }): Promise<InitializePaymentResponse> {
    if (!this.flutterwaveClient) {
      throw new AppError('Flutterwave is not configured. Please set FLUTTERWAVE_PUBLIC_KEY and FLUTTERWAVE_SECRET_KEY', 500);
    }

    try {
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

      const response = await this.flutterwaveClient.Payment.initialize(payload);

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

  async verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResponse> {
    const { gateway, reference } = params;

    switch (gateway) {
      case 'paystack':
        return this.verifyPaystackPayment(reference);

      case 'flutterwave':
        return this.verifyFlutterwavePayment(reference);

      case 'stripe':
        throw new AppError('Stripe integration not yet implemented', 501);

      case 'manual':
        throw new AppError('Cannot verify manual payment through gateway', 400);

      default:
        throw new AppError(`Unsupported payment gateway: ${gateway}`, 400);
    }
  }

  private async verifyPaystackPayment(reference: string): Promise<VerifyPaymentResponse> {
    if (!this.paystackClient) {
      throw new AppError('Paystack is not configured', 500);
    }

    try {
      const response = await this.paystackClient.transaction.verify(reference);

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

  private async verifyFlutterwavePayment(reference: string): Promise<VerifyPaymentResponse> {
    if (!this.flutterwaveClient) {
      throw new AppError('Flutterwave is not configured', 500);
    }

    try {
      const response = await this.flutterwaveClient.Transaction.verify({ tx_ref: reference });

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

  isGatewayConfigured(gateway: PaymentGateway): boolean {
    switch (gateway) {
      case 'paystack':
        return !!this.paystackClient;
      case 'flutterwave':
        return !!this.flutterwaveClient;
      case 'monnify':
        return false;
      case 'stripe':
        return false; // Not implemented yet
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

    return gateways;
  }
}

// Export singleton instance
export const paymentGatewayService = new PaymentGatewayService();

