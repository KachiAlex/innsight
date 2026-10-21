# syntax=docker/dockerfile:1.6
FROM node:20-slim AS deps
WORKDIR /usr/src/app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --include=dev --ignore-scripts

COPY prisma ./prisma
RUN npx prisma generate

FROM deps AS build
COPY . .
RUN npx -y esbuild src/index.ts --bundle --platform=node --target=node20 \
      --packages=external --format=cjs \
      --outfile=dist/bundle.js --ignore-annotations --log-level=warning
RUN npm prune --omit=dev

FROM node:20-slim AS runner
ENV NODE_ENV=production
WORKDIR /usr/src/app

# postgresql-client-16 is needed for pg_dump/pg_restore parity with the PG16
# server image; Debian bookworm only ships v15 by default, so use the PGDG repo.
RUN apt-get update -y \
  && apt-get install -y openssl ca-certificates curl gnupg \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
       -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
       > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update -y \
  && apt-get install -y postgresql-client-16 \
  && apt-get purge -y gnupg \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma
COPY package*.json ./

RUN mkdir -p /backups
ENV BACKUP_DIR=/backups

EXPOSE 8080
CMD ["node", "dist/bundle.js"]
