# Database Setup Guide for InnSight PMS

## Production (VPS)

The database runs as the `innsight-db` Docker container (PostgreSQL 16) on the VPS —
no external database service is needed. It is provisioned automatically by
`docker compose up` and migrations run via the `innsight-migrate` container.

Connection string inside the Docker network:

```
postgresql://innsight:<POSTGRES_PASSWORD>@db:5432/innsight
```

`POSTGRES_PASSWORD` lives in `/opt/innsight/.env` on the server.

## Local development

You need a PostgreSQL database reachable from your machine. Easiest options:

### Option A: Local Postgres

```bash
# Windows (installer) or:
docker run --name innsight-dev-db -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=innsight -p 5432:5432 -d postgres:16-alpine
```

`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/innsight`

### Option B: Hosted Postgres

Neon, Supabase, Railway, etc. — any Postgres 14+ works. Copy the connection
string into `DATABASE_URL`.

## Next Steps

With `DATABASE_URL` set in `backend/.env`:

```bash
cd backend
npx prisma migrate deploy   # create schema
npx prisma db seed          # optional seed data
npm run dev                 # start API on :3001
```
