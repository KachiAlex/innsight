-- Platform-level accounts (iitech_admin) carry no tenant
ALTER TABLE "users" ALTER COLUMN "tenantId" DROP NOT NULL;
