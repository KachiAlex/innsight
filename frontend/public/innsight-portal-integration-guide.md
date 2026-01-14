# InnSight Guest Portal Integration Guide

This guide walks through embedding the InnSight DIY checkout widget, consuming the public APIs, and subscribing to webhook events so your systems stay in sync with reservations and payments.

---

## 1. Surfaces

1. **Hosted Guest Portal** – every tenant instance lives at `https://innsight-2025.web.app/<tenantSlug>`. Link to it directly from your marketing site for the fastest deployment.
2. **Embeddable Widget** – a script-based CTA that mirrors your tenant branding and opens the hosted portal inside a modal (or a new tab if you switch modes).

Use the hosted link for primary navigation (e.g., “Book Now”) and place the widget on landing pages where you want to keep visitors on your domain.

---

## 2. Embedding the Widget

1. Configure your colors/logo under **Admin → Settings → Guest Portal Branding**.
2. Go to **Admin → Integrations**, copy the snippet, and paste it where the CTA should appear.
3. Keep the `data-tenant` attribute set to your tenant slug.
4. The widget auto-fetches availability, rates, and payment gateways from your tenant—no additional configuration required.

```html
<div id="innsight-portal-yourtenant"></div>
<script
  async
  src="https://innsight-2025.web.app/widget.js"
  data-tenant="your-tenant-slug"
  data-target="innsight-portal-yourtenant"
  data-mode="modal"
></script>
```

### Notes
- Whitelist `https://innsight-2025.web.app` if your CMS restricts third-party scripts.
- Set `data-mode="link"` to open the hosted portal in a new tab.
- To defer loading, wrap the snippet in a lazy loader and append it after `DOMContentLoaded`.

---

## 3. Public API Endpoints

The widget and hosted portal call the following routes. You can hit them directly to build custom experiences:

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/public/portal/<tenantSlug>/availability?checkInDate=...&checkOutDate=...` | GET | Returns available rooms and rate plans for the given range. |
| `/api/public/portal/<tenantSlug>/checkout/intent` | POST | Creates a checkout intent and returns `intentId`, `reference`, and an `authorizationUrl`. |
| `/api/public/portal/<tenantSlug>/checkout/confirm` | POST | Verifies payment and returns `customerToken`, `guestSessionToken`, reservation details, and folio references. |

**Headers:** All requests should include the `x-guest-session` header that was issued with the checkout intent. The widget manages this automatically.

---

## 4. Tokens to Capture After Checkout

The confirmation response provides:

- `customerToken` – guest-scoped JWT for calling tenant APIs on the guest’s behalf.
- `guestSessionToken` – session identifier for the DIY portal; reuse it for subsequent public calls.
- `reservationId` + `folioId` – references you can store in your CRM/ERP.

Persist these values if you plan to build custom dashboards or allow guests to manage bookings directly from your site.

---

## 5. Webhook Notifications

InnSight can notify your systems when key events occur.

### Events
- `reservation.confirmed`
- `payment.completed`

### Setup Steps
1. Navigate to **Admin → Integrations → Webhook notifications**.
2. Add your HTTPS endpoint, pick the event types, and click **Create webhook**.
3. Copy the generated secret; you will not be able to view it again.
4. Use the **Send test** button to trigger a sample payload.

### Signature Verification (Node.js)
```js
const crypto = require('crypto');
const signature = req.headers['x-innsight-signature'];
const computed = crypto
  .createHmac('sha256', process.env.INNSIGHT_WEBHOOK_SECRET)
  .update(rawBody) // raw JSON string
  .digest('hex');

if (computed !== signature) {
  return res.status(401).send('invalid signature');
}
```

Payload structure:
```json
{
  "tenantId": "tenant_123",
  "eventType": "reservation.confirmed",
  "sentAt": "2026-01-13T07:55:00.000Z",
  "data": {
    "reservationId": "res_abc",
    "folioId": "folio_xyz",
    "amountPaid": 45000,
    "currency": "NGN",
    "guest": { "name": "Jane Doe", "email": "jane@example.com" }
  }
}
```

Retry logic is managed on your side. If your endpoint responds with any 2xx status, the delivery is marked successful.

---

## 6. Recommended Implementation Checklist

1. Add the hosted link and/or widget snippet to your marketing site.
2. Configure webhook endpoints so your CRM, PMS, or automation platform receives reservation + payment events.
3. Store `customerToken`, `guestSessionToken`, `reservationId`, and `folioId` for downstream workflows.
4. If you need bespoke themes or offline payment flows, contact InnSight support with your tenant slug.

---

## 7. Support

- **Email:** support@innsight.africa
- **Docs:** Admin → Integrations tab (live snippets and examples)
- **Status:** https://status.innsight.africa

Please share feedback so we can evolve these APIs to match your integration roadmap.
