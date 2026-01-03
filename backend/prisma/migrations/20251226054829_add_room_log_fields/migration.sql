-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "lastLogAt" TIMESTAMP(3),
ADD COLUMN     "lastLogSummary" TEXT,
ADD COLUMN     "lastLogType" TEXT,
ADD COLUMN     "lastLogUserName" TEXT;
