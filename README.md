# InnSight - Multi-Tenant Property Management System

A cloud-based multi-tenant PMS for hotels/hostels with native accountability features (audit trails, transaction reconciliation, staff logs, photo evidence, automated alerts).

## Product Vision

A cloud multi-tenant PMS that runs hotels/hostels at scale, with native accountability features (audit trails, transaction reconciliation, staff logs, photo evidence, automated alerts). The IoT/Heatmap package is an optional module that enhances verification by matching physical occupancy to PMS records.

## Tech Stack

- **Backend**: Node.js + TypeScript + Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Frontend**: React + TypeScript + Vite
- **Authentication**: JWT with RBAC
- **Multi-tenancy**: tenant_id isolation
- **Deployment**: Docker Compose on VPS

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

### VPS Deployment (Docker)

The application is deployed as Docker containers on the VPS at `67.211.210.8`.
All data lives in the PostgreSQL container.

**Quick Deploy:**
```bash
bash deploy-vps.sh
```

The script uploads the repo to `/opt/innsight`, generates server secrets on first run,
and runs `docker compose up -d --build`.

| Surface | Platform | Description |
| --- | --- | --- |
| Frontend SPA | `innsight-web` container (nginx) | `http://67.211.210.8:3021` |
| Backend API | `innsight-api` container (Express + Socket.IO) | proxied same-origin via `/api` |
| Database | `innsight-db` container (PostgreSQL 16) | internal network only |

See `DEPLOYMENT.md` for detailed instructions.

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
