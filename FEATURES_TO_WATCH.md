# Features to Watch Out For - Implementation Guide

This document outlines all implemented features and important things to watch for when using or maintaining the system.

---

## 🔐 Authentication & Authorization

### ✅ Implemented Features
- **JWT-based authentication** with refresh tokens
- **Role-based access control** (8 roles: iitech_admin, owner, manager, front_desk, housekeeping, maintenance, accountant, staff)
- **Multi-tenant isolation** - users can only access their tenant's data
- **Firestore-based user management**

### ⚠️ Things to Watch For
1. **Token Expiration**: Refresh tokens are used automatically, but watch for 401 errors
2. **Role Permissions**: Some routes require specific roles (e.g., `/tenants` requires `iitech_admin`)
3. **Tenant Isolation**: Always verify `tenantId` matches in all queries to prevent data leaks
4. **Admin Account**: Default admin is `admin@insight.com` / `admin123` (change in production!)

---

## 🏢 Multi-Tenant Management

### ✅ Implemented Features
- **Tenant CRUD operations** (IITECH admin only)
- **Tenant creation** with automatic user creation
- **Tenant statistics** (user count, room count, etc.)
- **Firestore-based** tenant storage

### ⚠️ Things to Watch For
1. **Admin Access**: Only `iitech_admin` role can access `/tenants` route
2. **Tenant Creation**: Creates a default owner user automatically
3. **Tenant Slug**: Must be unique across all tenants
4. **Data Isolation**: All tenant data is isolated by `tenantId` field

---

## 📅 Reservations Management

### ✅ Implemented Features
- **Create reservations** with guest details, dates, rates
- **Check-in/Check-out** functionality
- **Overlap detection** - prevents double booking
- **Automatic folio creation** on check-in
- **Room status updates** (available → occupied on check-in)
- **Pagination** and filtering by status, room, dates
- **Firestore-based** storage

### ⚠️ Things to Watch For
1. **Overlap Detection**: Uses in-memory filtering (may be slow with many reservations)
2. **Date Validation**: Check-out must be after check-in
3. **Room Availability**: Checks for overlapping `confirmed` or `checked_in` reservations
4. **Folio Creation**: Automatically creates folio on check-in if it doesn't exist
5. **Room Rate Charge**: Automatically adds room rate as a charge to folio on check-in
6. **Status Flow**: `confirmed` → `checked_in` → `checked_out` / `cancelled` / `no_show`
7. **Reservation Number**: Auto-generated format: `RES-{timestamp}-{random}`

---

## 🏨 Rooms Management

### ✅ Implemented Features
- **Room CRUD operations**
- **Room status management** (available, occupied, dirty, clean, inspected, out_of_order, maintenance)
- **Bulk status updates**
- **Room type and floor management**
- **Rate plan assignment**
- **Reservation count** per room
- **Firestore-based** storage

### ⚠️ Things to Watch For
1. **Status Updates**: Room status changes automatically on check-in/check-out
2. **OrderBy Queries**: Falls back to in-memory sort if Firestore composite index missing
3. **Rate Plan Lookup**: May fail silently if rate plan doesn't exist (logs warning)
4. **Room Number Uniqueness**: Enforced at tenant level (same room number can exist in different tenants)
5. **Bulk Operations**: Updates multiple rooms at once (may take time)

---

## 💰 Rate Plans

### ✅ Implemented Features
- **Full CRUD operations** for rate plans
- **Name uniqueness** validation per tenant
- **Base rate** and currency management
- **Active/Inactive** status
- **Room count** tracking (how many rooms use each plan)
- **Seasonal rules** support (JSON field, not yet implemented in UI)
- **Firestore-based** storage

### ⚠️ Things to Watch For
1. **Name Uniqueness**: Rate plan names must be unique per tenant
2. **Deletion Protection**: Cannot delete rate plan if assigned to rooms
3. **Room Count**: Shows number of rooms using the plan (read-only)
4. **Currency**: Defaults to 'NGN', supports USD, EUR, GBP
5. **Seasonal Rules**: JSON field exists but UI not implemented yet

---

## 👥 Guest Profile Management

### ✅ Implemented Features
- **Guest search** by email, phone, name, or ID number
- **Guest list** with pagination
- **Detailed guest profile** with:
  - Statistics (total stays, nights, spent, averages)
  - Preferences (preferred room type, source)
  - Reservation history
  - Folio history
- **Guest aggregation** from reservations (no separate guest table)

### ⚠️ Things to Watch For
1. **Guest Identification**: Guests are identified by email, phone, or name from reservations
2. **Data Aggregation**: Guest data is computed from reservations (may be slow with many reservations)
3. **Duplicate Guests**: Same guest with different email/phone appears as separate guests
4. **Search Performance**: Searches all reservations (may be slow with large datasets)
5. **Guest Key**: Uses email (preferred) → phone → name as unique identifier

---

## 📊 Room Calendar

### ✅ Implemented Features
- **Calendar grid view** showing rooms vs dates
- **Color-coded status** indicators:
  - Green: Available
  - Blue: Occupied
  - Yellow: Check-in day
  - Pink: Check-out day
  - Red: Blocked
- **Drag-and-drop** to move reservations between rooms/dates
- **Quick reservation creation** by clicking empty cells
- **Date navigation** (previous/next/today)
- **Configurable date range** (7, 14, 30, 60 days)
- **Room and status filtering**
- **Reservation details modal**

### ⚠️ Things to Watch For
1. **Drag-and-Drop**: Only works for `confirmed` or `checked_in` reservations
2. **Availability Check**: Validates room availability before moving reservation
3. **Date Range**: Defaults to 30 days if not specified
4. **Performance**: May be slow with many rooms/dates (fetches all reservations)
5. **Overlap Detection**: Uses in-memory filtering for date overlaps
6. **Quick Create**: Pre-fills room and dates, but requires manual guest details entry

---

## 📋 Folios & Billing

### ✅ Implemented Features
- **Folio management** (create, view, update)
- **Charge management** (add charges to folios)
- **Payment tracking** (add payments, update balance)
- **Automatic balance calculation**
- **Folio status** (open, closed, voided)
- **Charge categories** (room_rate, service, tax, etc.)
- **Firestore-based** storage

### ⚠️ Things to Watch For
1. **Automatic Creation**: Folio created automatically on check-in
2. **Balance Calculation**: `balance = totalCharges - totalPayments`
3. **Atomic Updates**: Uses Firestore batches for folio totals
4. **Status Restrictions**: Cannot add charges/payments to closed/voided folios
5. **Room Rate Charge**: Added automatically on check-in
6. **Payment Updates**: Automatically updates folio balance when payment added

---

## 💳 Payments

### ✅ Implemented Features
- **Payment creation** with method, amount, reference
- **Payment methods** (cash, card, bank_transfer, mobile_money, etc.)
- **Payment gateway** support (manual, paystack, flutterwave - not yet integrated)
- **Automatic folio balance update**
- **Payment reconciliation** flag
- **Pagination** and filtering
- **Firestore-based** storage

### ⚠️ Things to Watch For
1. **Folio Update**: Automatically updates folio `totalPayments` and `balance`
2. **Atomic Operations**: Uses Firestore batches for consistency
3. **Payment Reference**: Auto-generated if not provided: `PAY-{timestamp}-{uuid}`
4. **Folio Status**: Cannot add payment to closed/voided folio
5. **Payment Gateway**: Structure exists but actual integration not implemented
6. **Reconciliation**: Flag exists but reconciliation workflow not implemented

---

## 📈 Reports

### ✅ Implemented Features
- **Revenue reports** with:
  - Total revenue by date range
  - Payment method breakdown
  - Daily breakdown (optional)
  - Transaction count
- **Occupancy reports** with:
  - ADR (Average Daily Rate)
  - RevPAR (Revenue per Available Room)
  - Occupancy percentage
  - Room nights
- **Shift reports** (basic structure)
- **Date range filtering**
- **Firestore-based** queries

### ⚠️ Things to Watch For
1. **Date Range Filtering**: Uses in-memory filtering (may be slow with many records)
2. **Empty Data Handling**: Returns zeros/empty arrays if no data (doesn't crash)
3. **Composite Indexes**: May need Firestore composite indexes for optimal performance
4. **Data Enrichment**: Fetches related data (rooms, users) which may slow queries
5. **Graceful Degradation**: Returns empty data if queries fail (logs warnings)

---

## 🧹 Housekeeping

### ⚠️ Status: Still Using Prisma (PostgreSQL)
- **Not yet migrated to Firestore**
- **Will return empty data if DATABASE_URL not configured**
- **Task management** structure exists
- **Room status updates** on task completion

### ⚠️ Things to Watch For
1. **Database Dependency**: Requires PostgreSQL/DATABASE_URL
2. **Migration Needed**: Should be migrated to Firestore for consistency
3. **Graceful Fallback**: Returns empty array if database unavailable

---

## 🔧 Maintenance

### ⚠️ Status: Still Using Prisma (PostgreSQL)
- **Not yet migrated to Firestore**
- **Ticket management** structure exists
- **Priority levels** (low, medium, high, urgent)
- **Photo upload** support (structure ready)

### ⚠️ Things to Watch For
1. **Database Dependency**: Requires PostgreSQL/DATABASE_URL
2. **Migration Needed**: Should be migrated to Firestore
3. **Photo Upload**: Structure exists but file upload not fully implemented

---

## 🔄 Shifts & Cash Management

### ⚠️ Status: Still Using Prisma (PostgreSQL)
- **Not yet migrated to Firestore**
- **Shift management** structure exists
- **Cash reconciliation** with variance detection
- **Shift reports**

### ⚠️ Things to Watch For
1. **Database Dependency**: Requires PostgreSQL/DATABASE_URL
2. **Migration Needed**: Should be migrated to Firestore
3. **Cash Reconciliation**: Variance detection logic exists but needs testing

---

## 🚨 Alerts

### ⚠️ Status: Still Using Prisma (PostgreSQL)
- **Not yet migrated to Firestore**
- **Alert generation** for anomalies
- **Alert types** and severity levels

### ⚠️ Things to Watch For
1. **Database Dependency**: Requires PostgreSQL/DATABASE_URL
2. **Migration Needed**: Should be migrated to Firestore
3. **Alert Generation**: Logic exists but needs integration with other modules

---

## 🔍 Audit Trail

### ⚠️ Status: Still Using Prisma (PostgreSQL)
- **Not yet migrated to Firestore**
- **Immutable audit logs** for critical actions
- **Before/after state** tracking
- **User action tracking**

### ⚠️ Things to Watch For
1. **Database Dependency**: Requires PostgreSQL/DATABASE_URL
2. **Migration Needed**: Should be migrated to Firestore
3. **Audit Logging**: Called in many routes but may not persist if database unavailable

---

## 📱 IoT Integration

### ⚠️ Status: Still Using Prisma (PostgreSQL)
- **Not yet migrated to Firestore**
- **IoT event ingestion** endpoints
- **Room occupancy detection** API
- **Device management** structure

### ⚠️ Things to Watch For
1. **Database Dependency**: Requires PostgreSQL/DATABASE_URL
2. **Migration Needed**: Should be migrated to Firestore
3. **Real-time Updates**: Structure exists but real-time features not implemented

---

## 🎨 Frontend Features

### ✅ Implemented Features
- **Code splitting** - Lazy loading for all pages
- **Dynamic imports** - Heavy libraries loaded on-demand
- **Protected routes** - Authentication guards
- **State management** - Zustand with persistence
- **API integration** - Axios with interceptors
- **Error handling** - Error boundaries and user feedback
- **Responsive design** - Mobile-friendly UI
- **Loading states** - Skeleton loaders
- **Toast notifications** - User feedback

### ⚠️ Things to Watch For
1. **Token Refresh**: Automatic token refresh on 401 errors
2. **Error Handling**: API errors show toast notifications
3. **Loading States**: All pages show loading skeletons while fetching
4. **Route Protection**: Unauthenticated users redirected to login
5. **State Persistence**: Auth state persists in localStorage

---

## 🗄️ Database Architecture

### Current State
- **Firestore**: Used for migrated routes (auth, tenants, reservations, rooms, folios, payments, reports, rate plans, guests, calendar)
- **PostgreSQL (Prisma)**: Used for non-migrated routes (housekeeping, maintenance, shifts, alerts, audits, IoT)

### ⚠️ Things to Watch For
1. **Hybrid Approach**: System uses both databases (may cause confusion)
2. **Migration Status**: 10 routes migrated, 6 routes still using Prisma
3. **DATABASE_URL**: Required for Prisma routes (optional for Firestore routes)
4. **Graceful Degradation**: Prisma routes return empty data if DATABASE_URL not configured
5. **Performance**: Firestore queries may need composite indexes for optimal performance

---

## 🚀 Deployment

### ✅ Implemented Features
- **Firebase Hosting** - Frontend deployed
- **Firebase Functions** - Backend deployed (Node.js 20)
- **Secrets Management** - JWT secrets configured
- **Environment Variables** - Properly configured

### ⚠️ Things to Watch For
1. **Function Timeout**: Default 60s timeout (may need adjustment for large queries)
2. **Cold Starts**: First request may be slow
3. **Secrets**: JWT_SECRET and JWT_REFRESH_SECRET must be set
4. **DATABASE_URL**: Optional but needed for Prisma routes
5. **CORS**: Configured for frontend domain

---

## 🔒 Security Considerations

### ✅ Implemented Features
- **Helmet** - Security headers
- **CORS** - Cross-origin protection
- **Rate Limiting** - API rate limiting
- **Input Validation** - Zod schemas
- **SQL Injection Protection** - Parameterized queries (Prisma)
- **XSS Protection** - React auto-escaping

### ⚠️ Things to Watch For
1. **Tenant Isolation**: Always verify tenantId in queries
2. **Role Checks**: Verify user roles before sensitive operations
3. **Input Validation**: All inputs validated with Zod
4. **Password Hashing**: bcrypt with salt rounds
5. **Token Security**: JWT tokens expire, refresh tokens rotate

---

## 📝 Important Notes

1. **Error Handling**: Most routes have try-catch blocks and return user-friendly errors
2. **Logging**: Console.error used for debugging (consider proper logging service)
3. **Performance**: Some queries use in-memory filtering (may be slow with large datasets)
4. **Indexes**: Firestore composite indexes may be needed for optimal performance
5. **Testing**: No automated tests yet (manual testing recommended)
6. **Documentation**: API documentation exists but may need updates

---

**Last Updated**: 2025-01-21
**Version**: 1.0.0

