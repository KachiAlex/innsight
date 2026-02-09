---
description: DIY portal optional signup & dashboard frontend plan
---

# DIY Portal – Optional Customer Signup & Dashboard Plan

## 1. Objectives
1. Offer a lightweight account creation option during or after reservation flow (guest keeps booking frictionless).
2. Let returning guests sign in with either reservation info, OTP, or username/password, consuming the new backend endpoints.
3. Expose a customer dashboard that gracefully handles:
   - Reservation-bound sessions only (legacy flow).
   - Account-only sessions (no active reservation yet).
   - Hybrid sessions that have both reservation + guestAccount context.
4. Document verification/test coverage so QA can validate without guessing flows.

## 2. Backend contracts to use
| Endpoint | Purpose | Notes |
| --- | --- | --- |
| `POST /api/public/portal/:slug/signup` | Create guest account | Returns `{ token, guestSessionToken, guestAccount }`. Requires `name, email, password`. |
| `POST /api/public/portal/:slug/login/password` | Password login | Returns `{ token, guestSessionToken, guestAccount, reservations }`. |
| `POST /api/public/portal/:slug/login/reservation` | Existing reservation login | Already wired; response now includes optional `guestAccount`. |
| `POST /api/public/portal/:slug/login/otp/*` | OTP flow; unchanged | When OTP verifies, response may include `guestAccount`. |
| `GET /api/public/portal/:slug/me` | Dashboard payload | Returns `{ reservation, guestAccount, reservations, guestSessionToken }`.

> Token persistence already handled by `publicApi` interceptors (@frontend/src/lib/publicApi.ts#21-140).

## 3. Frontend architecture additions
### State helpers
1. **`useCustomerSession` hook** (new file `src/hooks/useCustomerSession.ts`):
   - Wraps `publicApi.get('/:slug/me')` and exposes `{ loading, error, reservation, guestAccount, reservations, refresh }`.
   - Normalizes the three contexts (reservation-only / account-only / hybrid) into view-friendly flags.
2. **`customerAuthStore` (Zustand)** in `src/store/customerAuthStore.ts`:
   - Holds `tenantSlug`, `customerToken`, `guestSessionToken`, `guestAccount`, `primaryReservationId`.
   - Provides helpers `setAuthFromResponse`, `clearAuth`, `ensureTenant(slug)`. Mirrors backend cookie storage to keep React tree reactive.

### API helpers
Create `src/lib/publicCustomerApi.ts` that wraps relevant calls with typed responses:
- `signupCustomer(payload)` – POST `/signup`.
- `loginWithPassword(payload)` – POST `/login/password`.
- `loginWithReservation(payload)` – existing endpoint.
- `requestOtp`, `verifyOtp` – existing endpoints.
- `fetchCustomerProfile()` – GET `/me`.

Each helper should return `{ data, guestSessionToken, customerToken }` so UI can call `customerAuthStore.setAuthFromResponse`.

## 4. UX flows
### 4.1 Booking checkout page (existing `PublicCheckoutPage`)
1. **Inline CTA**: After guest fills contact info (Step 0), show a pill banner: “Want faster checkouts next time? Create a password after booking.”
   - Clicking opens modal `GuestSignupModal` (defined below) prefilled with `guestName`, `guestEmail`, `guestPhone` from form state.
2. **Post-confirmation surface**: When `confirmation.customerToken` exists (line ~530 onward), show a card summarizing:
   - Reservation details.
   - If `guestAccount` missing → button “Create account now” (opens modal, passes session token so signup uses same email).
   - If `guestAccount` present → button “Go to my dashboard” linking to `/portal/:slug/dashboard`.

### 4.2 Dedicated access entry point
Create route `/portal/:tenantSlug/access` containing three tabs:
1. **Reservation Lookup** – existing form (reservation number + email/phone) for parity.
2. **OTP Login** – request + verify steps.
3. **Password Login** – new form hitting `/login/password`.
   - Form states: `email`, `password`, `loading`, `error`.
   - On success → `customerAuthStore.setAuthFromResponse(slug, data)` then navigate to dashboard.
   - All tabs should surface a secondary CTA linking to signup modal.

### 4.3 Signup modal component (`<GuestSignupModal />`)
Props: `{ tenantSlug, open, onClose, defaultName, defaultEmail, defaultPhone }`.
Flow:
1. Fields `{ name, email, phone, password, marketingOptIn }` validated with Zod.
2. Submit → `signupCustomer`.
3. On success:
   - `customerAuthStore.setAuthFromResponse`.
   - Fire toast “Account ready! You can log in anytime.”
   - Close modal and optionally navigate to dashboard if `shouldRedirect` flag true.
4. Handle 409 error to prompt user to use login tab.

### 4.4 Dashboard screen (`/portal/:slug/dashboard`)
Structure:
1. **Hero panel** – shows guest name/email, and whether email is verified.
2. **Reservations list** – use `reservations` array from `/me`.
   - Highlight active/upcoming first, fallback to single reservation if only `reservation` present.
3. **Reservation detail card** – if `reservation` exists, display stay dates, room, contact options, and CTA to view folio (link to existing `/portal/:slug/reservations/:id` when implemented).
4. **Account settings** – placeholder for password reset / marketing opt-out.
5. **Empty states**:
   - Account-only without reservations: “Book your first stay” button leading back to `/portal/:slug` summary page.
   - Reservation-only (no account) but still logged in: show “Secure your account” card with CTA to open signup modal.

### 4.5 Global navbar entry
Add subtle “My trips” button for tenants that want to expose dashboard directly:
- In `PublicCheckoutPage` header (or global layout) show link to `/portal/:slug/access` when a guest account token exists or cookie indicates past activity (check `getCustomerToken`).

## 5. Component/file changes summary
| File | Change |
| --- | --- |
| `src/lib/publicApi.ts` | Already persists tokens; add util exports `hasCustomerToken`, `clearCustomerState` for logout. |
| `src/lib/publicCustomerApi.ts` (new) | Encapsulate signup/login/me calls. |
| `src/store/customerAuthStore.ts` (new) | Zustand store for DIY portal sessions. |
| `src/hooks/useCustomerSession.ts` (new) | Fetch + cache `/me` response. |
| `src/components/GuestSignupModal.tsx` (new) | Modal described above. |
| `src/pages/PublicCheckoutPage.tsx` | Add CTAs + modal integration. |
| `src/pages/PortalAccessPage.tsx` (new) | Tabbed login/signup entry. |
| `src/pages/PortalDashboardPage.tsx` (new) | Dashboard UI. |
| `src/router` updates | Map `/portal/:tenantSlug/access` & `/portal/:tenantSlug/dashboard`. |

## 6. Interaction details
1. **Token syncing**: whenever a response returns `guestSessionToken` or `customerToken`, call `persistGuestSessionToken` / `persistCustomerToken` (already automatic) then update store so React components rerender.
2. **Tenant slug context**: all new routes derive `tenantSlug` from URL params. Ensure `customerAuthStore` stores the slug to avoid mixing tokens between tenants.
3. **Error UX**: leverage shared toast utility; avoid leaking backend messages verbatim (map 409 to “Looks like you already have an account.”).
4. **Mobile layout**: modals should default to full-screen on screens <768px.
5. **Accessibility**: tabs use `role="tablist"`, `aria-selected`, focus trapping in modal.

## 7. Testing & validation checklist
### Manual QA
1. **Signup from checkout**
   - Complete booking, open signup modal, create account.
   - Confirm `/me` returns account with reservations.
2. **Login with password**
   - Hit `/portal/:slug/access`, use credentials → lands on dashboard, reservations show.
3. **Reservation-only login**
   - Use reservation lookup; dashboard should show CTA to secure account.
4. **OTP flow**
   - Request + verify OTP; ensure dashboard loads and tokens stored.
5. **Logout**
   - Clear customer token via “Sign out” button (to add) and verify localStorage cleaned.

### Automated ideas
1. **Component tests (React Testing Library)**
   - `GuestSignupModal` handles validation + 409 error.
   - `PortalAccessPage` tab switching preserves form state.
2. **Integration/e2e (Playwright/Cypress)**
   - Mock backend to simulate signup + login + dashboard fetch.
   - Ensure tokens saved to `localStorage` keys `diy_guest_session` / `diy_customer_token`.

## 8. Next actions
1. Implement shared store + API helpers.
2. Build signup modal + integrate into checkout + access pages.
3. Create new portal access + dashboard routes.
4. Add QA cases to existing regression checklist.

Once these are in place, we can move to UI polish (branding-aware colors, email verification banners) and eventually add password reset + marketing settings.
