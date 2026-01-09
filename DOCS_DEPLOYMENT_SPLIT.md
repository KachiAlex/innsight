# Deployment Split Overview

This document captures the current dual-platform deployment strategy (Firebase + Vercel) for InnSight.

## 1. Platform Responsibilities

| Surface | Platform | Description |
| --- | --- | --- |
| Frontend SPA | Firebase Hosting | Built assets from `frontend/dist` served via Hosting. Rewrites send `/api/**` into the `api` function and fall back to `index.html` for SPA routing. |
| Auth API (`/api/auth`) | Firebase Functions | Runs as part of the Cloud Function exported from `backend/src/index.ts`. Handles login, token issuance, password reset, etc. |
| Tenant Admin API (`/api/tenants/**`) | Firebase Functions | Same bundle as auth; manages onboarding, tenant metadata, and multi-tenant context for the relational services. |
| Prisma/Postgres APIs (`/api/tenants/:tenantId/...`) | Vercel Serverless | All other Express routers (reservations, folios, payments, housekeeping, maintenance, analytics, etc.) run on Vercel using Prisma and Neon Postgres. |

## 2. Routing Notes

- Firebase Hosting currently rewrites `/api/**` → `function:api`. When you need to call Vercel-hosted routes, use the Vercel base URL (e.g. `https://innsight-api.vercel.app/api/...`) or add explicit rewrite rules.
- Keep `frontend/src/lib/api.ts` (or equivalent) aware of which modules live on Firebase vs Vercel. Split the API client if needed (e.g., `firebaseApi` vs `vercelApi`).

## 3. Environment Variables

Maintain env vars in a single reference (`.env.example`, password manager). Update both Firebase and Vercel when secrets change.

| Variable | Firebase Functions | Vercel | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✔ (via `firebase functions:secrets:set`) | ✔ (Vercel Project Settings) | Neon Postgres connection for Prisma |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | ✔ | ✔ | JWT signing for auth |
| `CORS_ORIGIN` | ✔ | ✔ | Allowed frontend origin(s) |
| `FIREBASE_PROJECT_ID`, `GCLOUD_PROJECT` | ✔ | n/a | Used by Firebase admin SDK |
| Any 3rd-party keys (SendGrid, Twilio, etc.) | ✔ | ✔ | Ensure parity |

Recommended process:
1. Update `.env.example` and any internal documentation.
2. Apply the change in Firebase: `firebase functions:secrets:set KEY`.
3. Apply the change in Vercel: `vercel env add KEY production` (or via dashboard).

## 4. Deployment Workflow

### Firebase Hosting only
Use when frontend changes but backend stays the same.
```bash
npm run build --prefix frontend
firebase deploy --only hosting
```

### Firebase Functions (auth / tenants)
Use when auth/tenant code changes.
```bash
npm install --prefix backend
npm run build --prefix backend
firebase deploy --only functions:api
```

### Vercel APIs (Prisma modules)
Use when other backend routes or Prisma schema change.
```bash
cd backend
vercel --prod   # or push to the main branch if Vercel auto-deploys
```

Document in your ops runbook when both platforms must deploy (e.g., shared DTOs, auth contracts, or DB schema changes that affect both sides).

## 5. Future Considerations

- Consider consolidating everything on one platform if the dual deployment becomes hard to maintain.
- CI/CD: track separate jobs or GitHub Actions (one for Firebase, one for Vercel) so deployments are reproducible.
- Monitoring: add logging/alerts per-platform (Cloud Monitoring for Firebase, Vercel Analytics) to detect drift or outages.
