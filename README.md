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
