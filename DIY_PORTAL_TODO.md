# DIY Customer Portal TODO

## Phase 1 – Foundations
- [x] Capture initial architecture requirements (see docs/architecture.md)
- [x] Create public API surface for tenant-branded portal
  - [x] Tenant summary endpoint (branding/contact)
  - [x] Catalog endpoint (room categories, halls, add-ons)
  - [x] Availability endpoint for rooms & halls
  - [x] Public booking endpoint (anonymous + optional guest account)
  - [x] Public service-request endpoint (housekeeping, room service, maintenance)
- [x] Harden multi-tenant slug routing + branding cache
- [x] Define guest identity/session model (anonymous token + optional signup)

## Phase 2 – Payments & Booking Flow
- [ ] Payment provider abstraction
  - [ ] Define gateway config per tenant (keys, currencies, country support)
  - [ ] Create `payments/publicGateway.ts` to generate hosted-field/session payloads
  - [ ] Support Paystack + Flutterwave initially; keep Stripe stubbed
- [ ] Checkout orchestration
  - [ ] `/api/public/portal/:slug/checkout/intent` → returns client secret + amount
  - [ ] `/api/public/portal/:slug/checkout/confirm` → validates gateway status then creates reservation
  - [ ] Auto-create folio + ledger entry per successful booking
- [ ] Deposit / hold logic
  - [ ] Store deposit policy per rate plan/tenant
  - [ ] Generate `DepositPayment` entries with expiration timestamps
  - [ ] Cron/Cloud Task to void expired holds + notify guests
- [ ] Payment webhooks
  - [ ] `/api/public/payments/webhook/paystack`
  - [ ] `/api/public/payments/webhook/flutterwave`
  - [ ] Map events → folio charge, deposit release, reservation status updates
- [ ] Notifications & receipts
  - [ ] Email receipt template for successful payments
  - [ ] Staff alert when payment fails after intent creation

## Phase 3 – Guest Services
- [ ] API for in-stay service requests (housekeeping, room service, maintenance)
- [ ] Staff notification pipeline + assignment logic reuse
- [ ] Guest-facing status tracking + messaging threads

## Phase 4 – Frontend Experience
- [ ] Tenant-branded public portal shell (React/Vite)
- [ ] Availability search & booking funnel UI
- [ ] Guest account dashboard (history, receipts, requests)
- [ ] Mobile-first PWA enhancements (offline cart, push notifications)

## Observability & Security
- [ ] Rate limiting + bot protection for public endpoints
- [ ] Audit logging for guest actions
- [ ] Monitoring dashboards (conversion, service SLA)

## Phase 5 – Customer Login Flow
- [ ] Slug-aware login UX
  - [ ] Map vanity domains/hosts to tenant slug before hitting Express
  - [ ] Enforce slug segment on every customer-facing route
- [ ] Identity proof methods
  - [ ] Reservation-based login (reservationNumber + email/phone)
  - [ ] OTP login (request + verify endpoints, per-tenant rate limits)
  - [ ] Optional guest account password flow (future)
- [ ] Token/session handling
  - [ ] Issue JWT w/ tenantId + guestId scoped to slug
  - [ ] Middleware to enforce slug/tenant match on customer APIs
  - [ ] Reuse guestSession cookie; mark sessions converted once guest logs in
- [ ] Customer portal APIs
  - [ ] `POST /api/public/portal/:slug/login/reservation`
  - [ ] `POST /api/public/portal/:slug/login/otp/request`
  - [ ] `POST /api/public/portal/:slug/login/otp/verify`
  - [ ] `GET /api/public/portal/:slug/me` (customer profile + reservations)
- [ ] Notifications
  - [ ] Email/SMS template for OTP delivery (tenant-branded)
  - [ ] Audit logging of login attempts (success/failure)

## Notes
- All backend work should remain tenant-aware using slug → tenantId resolution.
- Favor prisma reads for catalog/availability; fall back to Firestore only where needed.
- Keep payment flows PCI compliant via tokenization; never store PAN data.
