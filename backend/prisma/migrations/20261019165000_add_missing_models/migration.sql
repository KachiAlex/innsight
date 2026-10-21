-- AlterTable
ALTER TABLE "audits" ALTER COLUMN "tenantId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "guest_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "guestId" TEXT,
    "reservationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "config" JSONB,
    "apiKey" TEXT,
    "webhookUrl" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "policyName" TEXT NOT NULL,
    "dataType" TEXT NOT NULL DEFAULT 'all',
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "autoDelete" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_agreements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'professional',
    "uptimePercentage" DOUBLE PRECISION NOT NULL DEFAULT 99.9,
    "avgResponseTimeMs" INTEGER NOT NULL DEFAULT 200,
    "maxErrorRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "supportResponseMinutes" INTEGER NOT NULL DEFAULT 30,
    "supportResolutionHours" INTEGER NOT NULL DEFAULT 24,
    "backupFrequencyHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_quotas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "maxRooms" INTEGER NOT NULL DEFAULT 50,
    "maxUsers" INTEGER NOT NULL DEFAULT 100,
    "maxReservations" INTEGER NOT NULL DEFAULT 1000,
    "maxStorageGB" INTEGER NOT NULL DEFAULT 100,
    "maxApiCallsPerDay" INTEGER NOT NULL DEFAULT 10000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_sessions_sessionToken_key" ON "guest_sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "guest_sessions_tenantId_status_idx" ON "guest_sessions"("tenantId", "status");

-- CreateIndex
CREATE INDEX "guest_sessions_expiresAt_idx" ON "guest_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "integrations_tenantId_status_idx" ON "integrations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "retention_policies_tenantId_policyName_idx" ON "retention_policies"("tenantId", "policyName");

-- CreateIndex
CREATE UNIQUE INDEX "sla_agreements_tenantId_key" ON "sla_agreements"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "resource_quotas_tenantId_key" ON "resource_quotas"("tenantId");

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_agreements" ADD CONSTRAINT "sla_agreements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_quotas" ADD CONSTRAINT "resource_quotas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

