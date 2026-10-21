-- AlterTable
ALTER TABLE "backup_records" ADD COLUMN     "scheduleId" TEXT;

-- AlterTable
ALTER TABLE "notification_logs" ADD COLUMN     "openCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "openedAt" TIMESTAMP(3);
