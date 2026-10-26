-- Add a per-room iCal export token and a table of external calendar
-- feeds (Airbnb / Booking.com / etc.) that are periodically imported.

ALTER TABLE "rooms" ADD COLUMN "icalToken" TEXT;

UPDATE "rooms" SET "icalToken" = gen_random_uuid()::text WHERE "icalToken" IS NULL;

ALTER TABLE "rooms" ALTER COLUMN "icalToken" SET NOT NULL,
                    ALTER COLUMN "icalToken" SET DEFAULT gen_random_uuid()::text;

CREATE UNIQUE INDEX "rooms_icalToken_key" ON "rooms"("icalToken");

CREATE TABLE "ical_feeds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT,
    "importUrl" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastSummary" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ical_feeds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ical_feeds_tenantId_idx" ON "ical_feeds"("tenantId");
CREATE INDEX "ical_feeds_roomId_idx" ON "ical_feeds"("roomId");

ALTER TABLE "ical_feeds" ADD CONSTRAINT "ical_feeds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ical_feeds" ADD CONSTRAINT "ical_feeds_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
