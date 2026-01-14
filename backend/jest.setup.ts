process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.SUPPRESS_FIREBASE_WARNING = 'true';

process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'test-paystack-secret';
process.env.PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || 'test-paystack-public';
process.env.FLUTTERWAVE_SECRET_KEY =
  process.env.FLUTTERWAVE_SECRET_KEY || 'test-flutterwave-secret';
process.env.FLUTTERWAVE_PUBLIC_KEY =
  process.env.FLUTTERWAVE_PUBLIC_KEY || 'test-flutterwave-public';
process.env.RUN_LOCAL_SERVER = 'false';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
