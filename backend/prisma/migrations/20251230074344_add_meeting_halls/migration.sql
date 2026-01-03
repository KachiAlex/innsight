-- CreateTable
CREATE TABLE "meeting_halls" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL,
    "location" TEXT,
    "amenities" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_halls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_booking_halls" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupBookingId" TEXT NOT NULL,
    "hallId" TEXT NOT NULL,
    "eventName" TEXT,
    "purpose" TEXT,
    "setupType" TEXT,
    "attendeeCount" INTEGER,
    "startDateTime" TIMESTAMP(3) NOT NULL,
    "endDateTime" TIMESTAMP(3) NOT NULL,
    "cateringNotes" TEXT,
    "avRequirements" TEXT,
    "status" TEXT NOT NULL DEFAULT 'tentative',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_booking_halls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_halls_tenantId_isActive_idx" ON "meeting_halls"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_halls_tenantId_name_key" ON "meeting_halls"("tenantId", "name");

-- CreateIndex
CREATE INDEX "group_booking_halls_tenantId_hallId_idx" ON "group_booking_halls"("tenantId", "hallId");

-- CreateIndex
CREATE INDEX "group_booking_halls_tenantId_groupBookingId_idx" ON "group_booking_halls"("tenantId", "groupBookingId");

-- CreateIndex
CREATE INDEX "group_booking_halls_tenantId_status_idx" ON "group_booking_halls"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "meeting_halls" ADD CONSTRAINT "meeting_halls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_booking_halls" ADD CONSTRAINT "group_booking_halls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_booking_halls" ADD CONSTRAINT "group_booking_halls_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "group_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_booking_halls" ADD CONSTRAINT "group_booking_halls_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "meeting_halls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
