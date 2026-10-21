-- DropIndex
DROP INDEX "rooms_lastStatusUpdate_idx";

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "paymentSettings" JSONB;

-- CreateTable
CREATE TABLE "guest_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "guestId" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_intents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "booking" JSONB NOT NULL,
    "pricing" JSONB NOT NULL,
    "gateway" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "amountMajor" DECIMAL(12,2) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "payDepositOnly" BOOLEAN NOT NULL DEFAULT false,
    "reference" TEXT NOT NULL,
    "authorizationUrl" TEXT,
    "accessCode" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "guest" JSONB,
    "roomSnapshot" JSONB,
    "sessionToken" TEXT,
    "reservationId" TEXT,
    "folioId" TEXT,
    "paymentDocumentId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkout_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL,
    "assignedTo" TEXT,
    "attachments" JSONB,
    "messages" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "satisfactionRating" INTEGER,
    "customFields" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guest_accounts_tenantId_guestId_idx" ON "guest_accounts"("tenantId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "guest_accounts_tenantId_email_key" ON "guest_accounts"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "guest_accounts_tenantId_phone_key" ON "guest_accounts"("tenantId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_intents_reference_key" ON "checkout_intents"("reference");

-- CreateIndex
CREATE INDEX "checkout_intents_tenantId_status_idx" ON "checkout_intents"("tenantId", "status");

-- CreateIndex
CREATE INDEX "checkout_intents_sessionToken_idx" ON "checkout_intents"("sessionToken");

-- CreateIndex
CREATE INDEX "support_tickets_tenantId_status_idx" ON "support_tickets"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "guest_accounts" ADD CONSTRAINT "guest_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_accounts" ADD CONSTRAINT "guest_accounts_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_intents" ADD CONSTRAINT "checkout_intents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
