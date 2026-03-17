-- AlterTable
ALTER TABLE "rooms" ADD COLUMN "lastStatusUpdate" TIMESTAMP(3),
ADD COLUMN "lastStatusUpdateBy" TEXT;

-- CreateIndex
CREATE INDEX "rooms_lastStatusUpdate_idx" ON "rooms"("lastStatusUpdate");
