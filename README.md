# InnSight - Multi-Tenant Property Management System

A cloud-based multi-tenant PMS for hotels/hostels with native accountability features (audit trails, transaction reconciliation, staff logs, photo evidence, automated alerts).

## Product Vision

A cloud multi-tenant PMS that runs hotels/hostels at scale, with native accountability features (audit trails, transaction reconciliation, staff logs, photo evidence, automated alerts). The IoT/Heatmap package is an optional module that enhances verification by matching physical occupancy to PMS records.

## Tech Stack

- **Backend**: Node.js + TypeScript + Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Frontend**: React + TypeScript + Vite
- **Authentication**: JWT with RBAC
- **Multi-tenancy**: Row-level security with tenant_id isolation

## Project Structure

```
innsight/
├── backend/          # Backend API server
├── frontend/         # React frontend application
├── shared/           # Shared types and utilities
└── docs/             # Documentation and API specs
```

## MVP Features

### Core Multi-Tenant PMS
- ✅ Multi-channel reservation ingestion
- ✅ Room inventory & rate management
- ✅ Check-in / Check-out workflows
- ✅ Billing & Payments (folios, multiple payment methods)
- ✅ Housekeeping & Maintenance
- ✅ Staff & Shift Management
- ✅ Accounting & Reporting
- ✅ Native Accountability & Anti-Fraud features
- ✅ Multi-tenancy & Admin

### Optional (Future)
- IoT Accountability Module
- Channel Manager / OTA integrations
- Payment gateway integrations

## Deployment

### Firebase Deployment

The application is configured for Firebase Hosting (frontend) and Firebase Functions (backend).

**Quick Deploy:**
```bash
# 1. Login to Firebase
firebase login

# 2. Initialize project (first time only)
firebase init

# 3. Set environment variables
firebase functions:secrets:set DATABASE_URL
firebase functions:secrets:set JWT_SECRET
firebase functions:secrets:set JWT_REFRESH_SECRET

# 4. Deploy
npm run deploy
```

See `FIREBASE_DEPLOYMENT.md` for detailed instructions.

### Current Deployment Topology

| Surface | Platform | Description |
| --- | --- | --- |
| Frontend SPA | **Firebase Hosting** (`frontend/dist`) | Served via `firebase.json` hosting config. Rewrites send `/api/**` to the `api` function before falling back to `index.html`. |
| Auth API (`/api/auth`) | **Firebase Functions** | Lives inside the monorepo Express app but is deployed with Cloud Functions. Shares secrets managed through `firebase functions:secrets:set`. |
| Tenant Admin API (`/api/tenants/**`) | **Firebase Functions** | Same Cloud Function bundle as `auth`, used for onboarding/tenant metadata. |
| Prisma / Postgres APIs (everything else under `/api/tenants/:tenantId/...`) | **Vercel Serverless** | Runs on Vercel using the same Express app + Prisma client pointing at Neon Postgres. |

This split lets legacy Firebase clients keep using the auth + tenant endpoints while newer modules use Vercel’s Prisma runtime.

#### Routing notes
* Firebase Hosting rewrite (`/api/** → function:api`) currently proxies *all* `/api` requests into the Firebase deployment. When hitting Vercel APIs from the frontend, call the Vercel base URL directly (e.g. `https://innsight-api.vercel.app/api/...`) or add explicit reverse-proxy rules.
* Keep the frontend config (`api.ts`, env vars) aligned so routes using Firebase vs. Vercel endpoints don’t drift.

#### Environment variables
Maintain a single truth (e.g. `.env.example`) covering both platforms:

| Variable | Firebase Functions | Vercel | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✔ (stored via `functions:secrets:set`) | ✔ (Project Settings → Environment Variables) | Neon Postgres connection string for Prisma |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | ✔ | ✔ | Used by auth/token issuance |
| `CORS_ORIGIN`, `FIREBASE_PROJECT_ID`, etc. | ✔ | ✔ | Make sure both stacks know the frontend origin + Firebase project identifiers |

Whenever a secret changes, update it in both Firebase and Vercel.

#### Deployment workflow

1. **Firebase Hosting only** (UI change, no backend updates)  
   ```bash
   npm run build --prefix frontend
   firebase deploy --only hosting
   ```
2. **Firebase Functions (auth / tenants)**  
   ```bash
   npm install --prefix backend
   npm run build --prefix backend
   firebase deploy --only functions:api
   ```
3. **Vercel APIs (Prisma modules)**  
   ```bash
   cd backend
   vercel --prod   # or push to main if Vercel is Git-integrated
   ```

Document the exact commands you use in production (CI pipelines, manual deploy steps) so the team knows when both platforms must redeploy together—e.g., schema changes that affect Prisma + auth should trigger both Firebase Functions and Vercel deploys.

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
```bash
cd backend && npm install
cd ../frontend && npm install
```

3. Set up environment variables (see `.env.example`)
4. Run database migrations:
```bash
cd backend && npx prisma migrate dev
```

5. Start development servers:
```bash
# Backend
cd backend && npm run dev

# Frontend
cd frontend && npm run dev
```

## API Documentation

See `docs/api.md` for detailed API documentation.

## Roadmap

- **Weeks 0-2**: Requirements, design, data model, API spec
- **Weeks 3-10**: Core PMS development (MVP features)
- **Weeks 11-12**: Client UAT, bug fixes, go-live
- **Month 4-5**: Payment gateway + channel manager integrations
- **Month 6-8**: IoT module development

## License

Proprietary - IITECH
