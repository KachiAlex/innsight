-- AlterTable
ALTER TABLE "rate_plans" ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "room_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "totalRooms" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "metadata" JSONB,
    "userId" TEXT,
    "userName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "night_audits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "auditDate" TIMESTAMP(3) NOT NULL,
    "auditDateTime" TIMESTAMP(3) NOT NULL,
    "performedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "discrepancies" JSONB,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "night_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountability_reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "lastReportAt" TIMESTAMP(3) NOT NULL,
    "flaggedCount" INTEGER NOT NULL DEFAULT 0,
    "noLogCount" INTEGER NOT NULL DEFAULT 0,
    "staleCount" INTEGER NOT NULL DEFAULT 0,
    "staleRooms" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accountability_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_categories_tenantId_idx" ON "room_categories"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "room_categories_tenantId_name_key" ON "room_categories"("tenantId", "name");

-- CreateIndex
CREATE INDEX "room_logs_tenantId_roomId_idx" ON "room_logs"("tenantId", "roomId");

-- CreateIndex
CREATE INDEX "room_logs_tenantId_type_idx" ON "room_logs"("tenantId", "type");

-- CreateIndex
CREATE INDEX "night_audits_tenantId_auditDate_idx" ON "night_audits"("tenantId", "auditDate");

-- CreateIndex
CREATE INDEX "night_audits_tenantId_status_idx" ON "night_audits"("tenantId", "status");

-- CreateIndex
CREATE INDEX "accountability_reports_tenantId_lastReportAt_idx" ON "accountability_reports"("tenantId", "lastReportAt");

-- CreateIndex
CREATE INDEX "rooms_tenantId_categoryId_idx" ON "rooms"("tenantId", "categoryId");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "room_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "room_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_categories" ADD CONSTRAINT "room_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_logs" ADD CONSTRAINT "room_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_logs" ADD CONSTRAINT "room_logs_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "night_audits" ADD CONSTRAINT "night_audits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "night_audits" ADD CONSTRAINT "night_audits_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountability_reports" ADD CONSTRAINT "accountability_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
