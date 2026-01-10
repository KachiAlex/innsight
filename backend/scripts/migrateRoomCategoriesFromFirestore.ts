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

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error('Usage: npx ts-node scripts/migrateRoomCategoriesFromFirestore.ts <tenantId>');
    process.exit(1);
  }

  const snapshot = await db.collection('roomCategories').where('tenantId', '==', tenantId).get();
  console.log(`Found ${snapshot.size} room categories in Firestore for tenant ${tenantId}.`);

  let migrated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data() || {};

    await prisma.roomCategory.upsert({
      where: { id: doc.id },
      update: {
        tenantId,
        name: (data.name ?? '').toString(),
        description: data.description ?? null,
        totalRooms: typeof data.totalRooms === 'number' ? data.totalRooms : null,
        color: data.color ?? null,
        createdAt: toDate(data.createdAt) ?? new Date(),
        updatedAt: toDate(data.updatedAt) ?? new Date(),
      },
      create: {
        id: doc.id,
        tenantId,
        name: (data.name ?? '').toString(),
        description: data.description ?? null,
        totalRooms: typeof data.totalRooms === 'number' ? data.totalRooms : null,
        color: data.color ?? null,
        createdAt: toDate(data.createdAt) ?? new Date(),
        updatedAt: toDate(data.updatedAt) ?? new Date(),
      },
    });
    migrated += 1;
  }

  console.log(`Migrated ${migrated} room categories into Postgres.`);
}

main()
  .catch((error) => {
    console.error('Room category migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
