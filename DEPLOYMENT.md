# InnSight PMS Deployment Guide — VPS (Docker)

InnSight is deployed as Docker containers on the VPS at `67.211.210.8`.
Everything runs on PostgreSQL via Prisma — no external database service needed.

## Architecture

| Service | Container | Exposure |
| ------- | --------- | -------- |
| `web` (nginx + React SPA) | `innsight-web` | `0.0.0.0:3061` (public) |
| `api` (Express + Socket.IO) | `innsight-api` | `127.0.0.1:3060` (localhost only) |
| `db` (PostgreSQL 16) | `innsight-db` | internal network only |
| `migrate` (one-shot) | `innsight-migrate` | runs `prisma migrate deploy`, then exits |

The frontend nginx proxies `/api/*` and `/socket.io/*` to the api container, so the
SPA and API are same-origin (no CORS issues, cookies/credentials work).

## SSH access

```bash
ssh -i ~/.ssh/innsight_vps root@67.211.210.8
```

## Deploy

From the repo root on the dev machine (Git Bash):

```bash
bash deploy-vps.sh
```

The script:

1. Tars the repo (excluding `node_modules`, `dist`, `.env`, etc.)
2. Copies it to `/opt/innsight` on the VPS
3. Generates `/opt/innsight/.env` with fresh `POSTGRES_PASSWORD`, `JWT_SECRET`,
   `JWT_REFRESH_SECRET` on first run
4. Runs `docker compose up -d --build` (runs migrations, then starts api + web)

## Manual operations on the server

```bash
cd /opt/innsight

docker compose ps                 # status
docker compose logs -f api        # api logs
docker compose logs -f db         # db logs
docker compose restart api        # restart api
docker compose up -d --build      # rebuild + redeploy

# Run migrations manually
docker compose run --rm migrate

# Postgres shell
docker compose exec db psql -U innsight -d innsight

# Create the IITECH superadmin account (once the api is up)
curl -X POST http://localhost:3060/api/auth/create-admin
```

## URLs

- App: `http://67.211.210.8:3061`
- API health: `http://67.211.210.8:3061/api/health`
- Tenant portal: `http://67.211.210.8:3061/<tenant-slug>`

## Environment variables

All secrets live in `/opt/innsight/.env` (generated on first deploy, `chmod 600`):

| Variable | Purpose |
| -------- | ------- |
| `POSTGRES_PASSWORD` | Postgres `innsight` user password |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | token signing |
| `CORS_ORIGIN` | allowed browser origins |
| `PUBLIC_PORTAL_BASE_URL` | base URL embedded in public portal links |

## Post-deployment checklist

- [ ] `docker compose ps` shows `innsight-db` healthy, `innsight-api` and `innsight-web` up
- [ ] `curl http://localhost:3060/api/health` on the VPS returns `{ "status": "ok" }`
- [ ] `http://67.211.210.8:3061` loads the SPA
- [ ] Create superadmin, log in, create a tenant, verify dashboard loads
- [ ] Payment gateway keys (Paystack/Flutterwave/Stripe) configured per tenant in Settings
