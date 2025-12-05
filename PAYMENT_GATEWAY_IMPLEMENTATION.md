# Payment Gateway Integration Implementation

## ✅ Completed Features

### 1. Payment Gateway Service
- ✅ Created abstraction layer (`backend/src/utils/paymentGateway.ts`)
- ✅ Paystack integration
- ✅ Flutterwave integration
- ✅ Support for multiple gateways
- ✅ Gateway configuration checking
- ✅ Unified API for all gateways

### 2. Payment Initialization
- ✅ **POST `/api/tenants/:tenantId/payments/initialize`**
  - Initialize payment with selected gateway
  - Returns authorization URL for redirect
  - Creates pending payment record
  - Supports custom callback URLs

### 3. Payment Verification
- ✅ **POST `/api/tenants/:tenantId/payments/verify`**
  - Verify payment status with gateway
  - Update payment and folio records
  - Automatic receipt email on success
  - Status tracking (pending/completed/failed)

### 4. Webhook Handlers
- ✅ **POST `/api/tenants/:tenantId/payments/webhook/:gateway`**
  - Paystack webhook support
  - Flutterwave webhook support
  - Automatic payment verification
  - Folio balance updates
  - Receipt email automation

### 5. Gateway Management
- ✅ **GET `/api/tenants/:tenantId/payments/gateways`**
  - List available payment gateways
  - Show configuration status
  - Help frontend determine available options

## 🔧 Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxx

# Flutterwave Configuration
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxxxxxxxxxxxx
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxxxxxxxxxx
```

### Getting API Keys

**Paystack:**
1. Sign up at https://paystack.com
2. Go to Settings > API Keys & Webhooks
3. Copy your Secret Key (starts with `sk_`)

**Flutterwave:**
1. Sign up at https://flutterwave.com
2. Go to Settings > API Keys
3. Copy your Public Key and Secret Key

## 📡 API Endpoints

### Initialize Payment

```http
POST /api/tenants/:tenantId/payments/initialize
Authorization: Bearer <token>
Content-Type: application/json

{
  "folioId": "uuid",
  "gateway": "paystack" | "flutterwave",
  "callbackUrl": "https://yoursite.com/payment/callback" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authorizationUrl": "https://paystack.com/pay/...",
    "reference": "PAY-1234567890-ABC123",
    "gateway": "paystack",
    "amount": 50000
  }
}
```

### Verify Payment

```http
POST /api/tenants/:tenantId/payments/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "reference": "PAY-1234567890-ABC123",
  "gateway": "paystack"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "payment-id",
      "status": "completed",
      "amount": 50000,
      ...
    },
    "verification": {
      "status": "success",
      "amount": 50000,
      "currency": "NGN",
      "reference": "PAY-1234567890-ABC123",
      "gateway": "paystack"
    }
  }
}
```

### Webhook Endpoint

```http
POST /api/tenants/:tenantId/payments/webhook/:gateway
Content-Type: application/json

{
  // Gateway-specific webhook payload
}
```

**Note:** Webhook URLs should be configured in your gateway dashboard:
- Paystack: Settings > API Keys & Webhooks
- Flutterwave: Settings > Webhooks

## 🔄 Payment Flow

### Standard Flow
1. **Initialize Payment**
   - Frontend calls `/payments/initialize`
   - Backend creates pending payment record
   - Returns authorization URL
   - Frontend redirects user to gateway

2. **User Completes Payment**
   - User pays on gateway page
   - Gateway redirects to callback URL
   - Frontend calls `/payments/verify`

3. **Payment Verification**
   - Backend verifies with gateway
   - Updates payment status
   - Updates folio balance
   - Sends receipt email

### Webhook Flow (Recommended)
1. **Initialize Payment** (same as above)
2. **User Completes Payment**
   - Gateway sends webhook to backend
   - Backend automatically verifies and updates
3. **Frontend Polls or Redirects**
   - Frontend can check payment status
   - Or redirect to success page

## 🎯 Features

### Gateway Abstraction
- Unified interface for all gateways
- Easy to add new gateways
- Consistent error handling
- Configuration checking

### Payment Tracking
- Pending → Completed/Failed status flow
- Gateway transaction ID storage
- Payment reference tracking
- Automatic folio updates

### Integration Points
- **Folio Integration**: Automatic balance updates
- **Email Integration**: Receipt emails on success
- **Audit Logging**: All payment actions logged
- **Reservation Integration**: Links payments to reservations

## 🔒 Security Considerations

### Webhook Verification (TODO)
Currently, webhooks accept all requests. For production:

1. **Paystack Webhook Verification:**
```typescript
import crypto from 'crypto';

const hash = crypto
  .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (hash !== req.headers['x-paystack-signature']) {
  return res.status(400).json({ error: 'Invalid signature' });
}
```

2. **Flutterwave Webhook Verification:**
```typescript
import crypto from 'crypto';

const hash = crypto
  .createHmac('sha256', process.env.FLUTTERWAVE_SECRET_KEY!)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (hash !== req.headers['verif-hash']) {
  return res.status(400).json({ error: 'Invalid signature' });
}
```

### Best Practices
- ✅ Use HTTPS for webhook URLs
- ✅ Verify webhook signatures
- ✅ Idempotent webhook processing
- ✅ Log all webhook events
- ✅ Handle duplicate webhooks

## 📝 Next Steps

### Recommended Enhancements
- ⏳ **Webhook Signature Verification** (Critical for production)
- ⏳ **Stripe Integration** (for international payments)
- ⏳ **Payment Retry Logic** (for failed payments)
- ⏳ **Refund Support** (via gateway APIs)
- ⏳ **Payment Method Selection UI** (frontend)
- ⏳ **Payment Status Polling** (frontend)
- ⏳ **Payment History Dashboard** (frontend)

### Frontend Integration
1. Create payment initialization form
2. Handle gateway redirect
3. Implement payment verification
4. Show payment status
5. Handle success/failure states

## 🧪 Testing

### Test Mode
Both Paystack and Flutterwave support test mode:

**Paystack Test Cards:**
- Success: `4084084084084081`
- Decline: `5060666666666666666`
- Insufficient Funds: `5060666666666666667`

**Flutterwave Test Cards:**
- Success: `5531886652142950`
- Decline: `5560000000000001`

### Testing Flow
1. Use test API keys
2. Initialize payment with test folio
3. Use test card numbers
4. Verify payment completion
5. Check folio balance update
6. Verify receipt email

## 📚 Files Modified

1. `backend/src/utils/paymentGateway.ts` - New file (gateway service)
2. `backend/src/routes/payments.ts` - Added gateway endpoints
3. `backend/package.json` - Added paystack and flutterwave-node-v3

## ✅ Status

**Backend:** ✅ Complete and ready for testing  
**Configuration:** ⏳ Requires API keys setup  
**Webhook Security:** ⏳ Signature verification pending  
**Frontend:** ⏳ Pending integration  

**Ready for:** Configuration, testing, and frontend integration!

