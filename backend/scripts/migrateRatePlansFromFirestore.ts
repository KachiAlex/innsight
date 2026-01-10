import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultServiceAccountPath = path.resolve(__dirname, '../serviceAccount.innsight-2025.json');
const explicitServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ? path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  : defaultServiceAccountPath;

if (!admin.apps.length) {
  if (fs.existsSync(explicitServiceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(explicitServiceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    console.log(`Initialized Firebase using ${explicitServiceAccountPath}`);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG) {
    admin.initializeApp();
    console.log('Initialized Firebase using GOOGLE_APPLICATION_CREDENTIALS/FIREBASE_CONFIG.');
  } else {
    throw new Error(
      'Firebase credentials not found. Provide FIREBASE_SERVICE_ACCOUNT_PATH or add serviceAccount.innsight-2025.json.'
    );
  }
}

console.log('Using Firebase project:', admin.app().options.projectId);

const db = admin.firestore();

const toDate = (value: admin.firestore.Timestamp | Date | string | null | undefined): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof admin.firestore.Timestamp) return value.toDate();
  if (typeof value === 'string') return new Date(value);
  return null;
};

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return num;
};

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error('Usage: npx ts-node scripts/migrateRatePlansFromFirestore.ts <tenantId>');
    process.exit(1);
  }

  const snapshot = await db.collection('ratePlans').where('tenantId', '==', tenantId).get();
  console.log(`Found ${snapshot.size} rate plans in Firestore for tenant ${tenantId}.`);

  let migrated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data() || {};

    await prisma.ratePlan.upsert({
      where: { id: doc.id },
      update: {
        tenantId,
        categoryId: typeof data.categoryId === 'string' && data.categoryId.length > 0 ? data.categoryId : null,
        name: (data.name ?? '').toString(),
        description: data.description ?? null,
        baseRate: toNumber(data.baseRate),
        currency: data.currency ?? 'NGN',
        seasonalRules: data.seasonalRules ?? null,
        isActive: data.isActive ?? true,
        createdAt: toDate(data.createdAt) ?? new Date(),
        updatedAt: toDate(data.updatedAt) ?? new Date(),
      },
      create: {
        id: doc.id,
        tenantId,
        categoryId: typeof data.categoryId === 'string' && data.categoryId.length > 0 ? data.categoryId : null,
        name: (data.name ?? '').toString(),
        description: data.description ?? null,
        baseRate: toNumber(data.baseRate),
        currency: data.currency ?? 'NGN',
        seasonalRules: data.seasonalRules ?? null,
        isActive: data.isActive ?? true,
        createdAt: toDate(data.createdAt) ?? new Date(),
        updatedAt: toDate(data.updatedAt) ?? new Date(),
      },
    });
    migrated += 1;
  }

  console.log(`Migrated ${migrated} rate plans into Postgres.`);
}

main()
  .catch((error) => {
    console.error('Rate plan migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
