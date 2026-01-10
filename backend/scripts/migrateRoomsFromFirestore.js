const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const getServiceAccount = () => {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  }
  const defaultPath = path.resolve(__dirname, '../serviceAccount.innsight-2025.json');
  if (fs.existsSync(defaultPath)) {
    return JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
  }
  throw new Error('Firebase service account credentials not found.');
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(getServiceAccount()),
  });
}

const db = admin.firestore();

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (value.toDate) {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  return null;
};

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const normalizeId = (value) => {
  if (!value) return null;
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
};

async function migrateRooms(tenantId) {
  console.log(`Fetching rooms from Firestore for tenant ${tenantId}...`);
  const snapshot = await db.collection('rooms').where('tenantId', '==', tenantId).get();
  console.log(`Found ${snapshot.size} rooms. Migrating...`);

  let migrated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const payload = {
      tenantId,
      roomNumber: (data.roomNumber ?? '').toString(),
      roomType: (data.roomType ?? 'standard').toString(),
      floor: toNumber(data.floor),
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
      update: payload,
      create: {
        id: doc.id,
        ...payload,
      },
    });
    migrated += 1;
  }

  console.log(`Migration complete. Upserted ${migrated} rooms.`);
}

(async () => {
  const tenantId = process.argv[2];
  if (!tenantId) {
    console.error('Usage: node scripts/migrateRoomsFromFirestore.js <tenantId>');
    process.exit(1);
  }
  try {
    await migrateRooms(tenantId);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
