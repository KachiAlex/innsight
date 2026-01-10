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

const normalizeId = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return num;
};

async function main() {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error('Usage: npx ts-node scripts/migrateRoomsFromFirestore.ts <tenantId>');
    process.exit(1);
  }

  const roomsSnapshot = await db.collection('rooms').where('tenantId', '==', tenantId).get();
  console.log(`Found ${roomsSnapshot.size} rooms in Firestore for tenant ${tenantId}.`);

  let migrated = 0;
  for (const doc of roomsSnapshot.docs) {
    const data = doc.data() || {};

    const roomPayload = {
      tenantId,
      roomNumber: (data.roomNumber ?? '').toString(),
      roomType: (data.roomType ?? '').toString() || 'standard',
      floor: toNumber(data.floor) ?? null,
      status: (data.status ?? 'available').toString(),
      maxOccupancy: toNumber(data.maxOccupancy) ?? 1,
      amenities: data.amenities ?? null,
      ratePlanId: normalizeId(data.ratePlanId),
      categoryId: normalizeId(data.categoryId),
      description: data.description ?? null,
      customRate: toNumber(data.customRate),
      lastLogType: data.lastLogType ?? null,
      lastLogSummary: data.lastLogSummary ?? null,
      lastLogUserName: data.lastLogUserName ?? null,
      lastLogAt: toDate(data.lastLogAt),
      createdAt: toDate(data.createdAt) ?? new Date(),
      updatedAt: toDate(data.updatedAt) ?? new Date(),
    };

    await prisma.room.upsert({
      where: { id: doc.id },
      update: roomPayload,
      create: {
        id: doc.id,
        ...roomPayload,
      },
    });
    migrated += 1;
  }

  console.log(`Migrated ${migrated} rooms into Postgres.`);
}

main()
  .catch((error) => {
    console.error('Room migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
