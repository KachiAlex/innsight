# InnSight — Multi-Tenant Hotel Property Management System (PMS)

> Product specification for UI generation. Describes the application surfaces, roles,
> screens, data model, workflows, and design language.

## 1. Product Overview

InnSight is a **multi-tenant SaaS hotel/hostel property management system**. Three
distinct user populations share one codebase:

1. **Platform operator (superadmin)** — manages tenant hotels, billing, SLAs, quotas,
   backups, integrations.
2. **Hotel staff (tenant users)** — run daily hotel operations: reservations,
   check-in/out, housekeeping, POS, night audit.
3. **Guests** — self-service booking portal and request tracking per hotel.

**Current stack** (match conventions if regenerating): React 18 + TypeScript + Vite,
React Router 7, Zustand (auth store), Axios, TanStack React Query, Recharts,
Socket.IO client, jsPDF + ExcelJS (exports), Lucide icons. Styling is inline
`style={{}}` objects — no Tailwind, no component library. Dark theme (`#242424`
base, `rgba(255,255,255,0.87)` text, Inter font).

## 2. Roles

| Role | Scope | Sees |
|---|---|---|
| `iitech_admin` | Platform-wide | Superadmin console only (tenant sidebar hidden) |
| `owner` | Their tenant | Everything |
| `general_manager` | Their tenant | Everything operational |
| `front_desk` | Tenant | Reservations, guests, folios, payments, calendar |
| `housekeeping` / `housekeeping_supervisor` / `housekeeping_staff` | Tenant | Housekeeping, room status, lost & found |
| `maintenance` | Tenant | Maintenance tickets |
| `accountant` | Tenant | Folios, payments, deposits, reports, night audit |
| `staff` | Tenant | Limited operational views |

## 3. Surfaces & Routes

### A. Public Marketing Site (unauthenticated)

| Route | Screen |
|---|---|
| `/` | Landing page: hero, feature grid (Reservations, Rooms, Folios, Analytics, Security, Realtime), CTA to login/signup |
| `/login` | Platform login (email + password + tenant selector) |
| `/tenant/login` | Tenant-scoped staff login |
| `/:tenantSlug` | Hotel's public booking landing page |
| `/portal/:tenantSlug/access` | Guest portal access (email → OTP verification) |
| `/portal/:tenantSlug/checkout` | Public checkout: pick room → dates → guest details → payment (Paystack/Flutterwave/Monnify/Stripe) |
| `/portal/:tenantSlug/dashboard` | Authenticated guest portal: my bookings, submit/track requests, order room service |

### B. Tenant PMS App (authenticated staff) — sidebar nav, 23 items

| Route | Screen | Contents |
|---|---|---|
| `/dashboard` | Operations dashboard | KPI cards (occupancy %, today's arrivals/departures, revenue, in-house guests, available rooms) with status-colored health indicators (good/warning/critical); charts; alerts feed |
| `/reservations` | Reservation list | Table: number, guest, room, dates, status (confirmed/checked_in/checked_out/cancelled/no_show), source, rate, balance. Create/edit/cancel, check-in/check-out actions |
| `/group-bookings` | Group bookings | Multi-room reservations, room blocks, meeting-hall bookings, per-group revenue/room totals |
| `/deposit-management` | Deposits | Deposit policies, deposit payments ledger, held/refunded amounts |
| `/calendar` | Tape-chart calendar | Rooms × dates grid, drag-to-reserve, occupancy visualization |
| `/rooms` | Room inventory | Room cards/grid: number, category, floor, status (available/occupied/clean/dirty/inspected/out_of_order/blocked/in_use), custom rates |
| `/rate-plans` | Rate plans | Named pricing tiers tied to room categories |
| `/guests` | Guest directory | Searchable list → `/guests/:id` profile: stay history, notes, loyalty points, activity log |
| `/guest-requests` | Request inbox | Guest-submitted requests with status workflow (new/in_progress/resolved), threaded messages |
| `/lost-found` | Lost & found | Item log: description, location found, value, claimant status |
| `/folios` | Guest folios | Per-stay bill: line-item charges, running balance, payments applied |
| `/payments` | Payments | Payment ledger: method (cash/card/transfer/gateway), amount, reference, linked folio/reservation |
| `/housekeeping` | Housekeeping | Task board: assign staff, room, priority, status, checklist |
| `/room-service` | Room service POS | Menu categories/items with prices, order cart per room/guest, order status flow, subtotal+tax+service charge+total |
| `/maintenance` | Maintenance | Ticket queue: room/area, issue, priority, assignee, status |
| `/reports` | Reports | Revenue, occupancy, payment-method breakdowns, deposits held; PDF/Excel export |
| `/analytics` | Analytics dashboard | Charts: occupancy trends, revenue, ADR/RevPAR, guest behavior, predictive metrics |
| `/night-audit` | Night audit | End-of-day close: reconcile folios, accountability report, roll business date |
| `/staff` | Staff management | Users, roles, shifts, active status |
| `/wage-plans` | Wage plans | Pay structures per role |
| `/settings` | Tenant settings | Hotel profile, payment settings (per-tenant gateway credentials), webhooks |
| `/integrations` | Integrations | Third-party integration configs |
| `/alerts` | Alerts | System/business alerts feed with severity |

### C. Superadmin Console (`iitech_admin`)

| Route | Screen |
|---|---|
| `/superadmin-dashboard` | Platform KPIs: total/active tenants, users, rooms, reservations, revenue, ADR, RevPAR, new tenants this month, subscription status breakdown |
| `/superadmin/tenants` + `/tenants` | Tenant list: name, slug, plan, subscriptionStatus (active/trial/suspended), stats; suspend/reactivate/delete + **batch** actions |
| `/superadmin-users` | Cross-tenant user management |
| `/billing` | Billing/subscriptions, invoices, plans |
| `/platform-analytics` | Growth charts: tenant/user/reservation/revenue growth, top & underperforming tenants |
| `/tenant-quotas` | Per-tenant resource quotas (rooms, users, API calls) + usage bars |
| `/sla-dashboard` | SLA agreements per tenant, uptime %, violation metrics |
| `/support-tickets` | Tenant support ticket queue |
| `/api-management` | API keys per tenant, usage metrics |
| `/integrations` | Platform-level integration management |
| `/backup-restore` | Backup records + schedules: run now, download, restore, retention days |
| `/communications` | Email send log + metrics (sent, open rate via tracking pixel), templates |
| `/audit-logs` | Cross-tenant audit trail: user, action, resource, timestamp; filters + export |
| `/data-retention` | Retention policies per data type, cleanup runs |
| `/system-settings` | Platform-wide config |

## 4. Core Data Entities

- **Tenant** — hotel account (name, slug, plan, subscriptionStatus, metadata,
  paymentSettings JSON)
- **User** — staff member (tenantId, role, email, name, isActive)
- **Room / RoomCategory / RatePlan** — inventory; room status enum drives the
  tape chart
- **Reservation** — number, guest, room, check-in/out dates, adults/children,
  nightly `rate`, deposit fields, status, source (manual/portal/api)
- **Guest / GuestNote / GuestActivityLog / LoyaltyProgram / LoyaltyTransaction /
  GuestAccount** — CRM layer
- **Folio / FolioCharge / Payment** — billing: charges accrue to folio, payments
  settle it
- **HousekeepingTask, MaintenanceTicket, LostItem,
  GuestRequest(+Messages/Updates)** — operations
- **MenuCategory / MenuItem / RoomServiceOrder(+Items)** — POS
- **GroupBooking / RoomBlock / MeetingHall / GroupBookingHallReservation** —
  group & events
- **DepositPolicy / DepositPayment** — deposit rules + ledger
- **NightAudit / AccountabilityReport / RoomLog** — daily close & audit trail
- **Shift / WagePlan** — staffing
- **Alert / SmartAlert / IoTGateway / IoTSensor / IoTEvent** — alerting + IoT hooks
- **AnalyticsMetric / PredictiveModel / GuestBehavior / InventoryAnalytics /
  WorkflowRule / OverbookingSetting / OverbookingAlert** — intelligence layer
- Platform-side: **Integration, RetentionPolicy, SLAAgreement, ResourceQuota,
  ApiKey/ApiUsage, BackupRecord/BackupSchedule, SupportTicket, EmailTemplate,
  NotificationLog, Webhook, CheckoutIntent, GuestSession, Audit**

## 5. Key Workflows

1. **Book → Check-in → Stay → Check-out**: create reservation (or guest
   self-books via portal checkout with payment) → check-in assigns
   checkedInBy/timestamp → charges post to folio during stay → check-out settles
   balance.
2. **Deposit lifecycle**: policy defines required % → deposit payment recorded →
   held → applied/refunded at checkout.
3. **Housekeeping loop**: checkout marks room dirty → task assigned → clean →
   inspected → available.
4. **Room service**: guest/staff builds order from menu → subtotal + tax +
   service charge → posted to folio.
5. **Night audit**: close the day — reconcile all open folios, produce
   accountability report.
6. **Guest requests**: guest submits via portal → staff inbox → threaded replies
   → resolved.
7. **Tenant lifecycle (superadmin)**: onboard tenant → monitor quota/SLA/billing
   → suspend/reactivate/delete (single or batch).
8. **Backups**: schedule or manual database dump → record → download/restore,
   retention pruning.

## 6. Design Language

- Dark theme, dense data-first admin UI, left icon sidebar, Lucide icons.
- Status-colored everything: room status pills, severity badges, health
  indicators (good/warning/critical), subscription badges.
- Patterns per screen: KPI stat cards → filter bar → data table or card grid →
  row actions + detail drawer/modal → create/edit modal forms.
- Command palette (Ctrl+K) over all nav items.
- Charts via Recharts; exports via jsPDF (PDF) and ExcelJS (xlsx).
- Realtime updates via Socket.IO (room status, alerts, reservation changes).

## 7. API Shape (for mock data)

REST under `/api/*`, JSON envelope `{ success: true, data: {...} }` /
`{ success: false, error: { message } }`. Auth: `Authorization: Bearer <jwt>`.

Key resources: `/auth/login`, `/dashboard`, `/reservations`, `/rooms`, `/guests`,
`/folios`, `/payments`, `/housekeeping`, `/room-service`, `/maintenance`,
`/reports`, `/calendar`, `/night-audit`, `/staff`, `/settings`, `/alerts`, and
`/superadmin/*` for the platform console, `/public/*` for portal/checkout
(no auth).

## 8. Important Caveats

- **It is three UIs, not one**: marketing site, staff PMS, guest portal, and
  superadmin console. Build one surface at a time.
- **The money field**: `Reservation.rate` is the *nightly* rate — reservation
  total = `rate × nights`. Any revenue UI should reflect that.
