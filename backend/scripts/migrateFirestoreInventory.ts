import admin from 'firebase-admin';
import { Prisma, PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(__dirname, '../serviceAccount.innsight-2025.json');

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(
    `Service account credentials not found at ${serviceAccountPath}. Set GOOGLE_APPLICATION_CREDENTIALS to a valid path.`
  );
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.INNSIGHT_FIREBASE_PROJECT_ID || 'innsight-2025',
  });
}

const db = admin.firestore();
const prisma = new PrismaClient();

const toJsDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  if (value instanceof admin.firestore.Timestamp) {
    try {
      return value.toDate();
    } catch (error) {
      console.warn('Failed to convert timestamp', error);
      return undefined;
    }
  }
  return undefined;
};

const toDecimal = (value: any): Prisma.Decimal | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return null;
  return new Prisma.Decimal(num);
};

const normalizeJson = (value: any) => {
  if (value === undefined) return null;
  return value;
};

async function upsertTenant(tenantId: string, data: admin.firestore.DocumentData) {
  const createdAt = toJsDate(data.createdAt) ?? new Date();
  const updatedAt = toJsDate(data.updatedAt) ?? createdAt;

  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {
      name: data.name || 'Untitled Property',
      slug: data.slug || tenantId,
      email: data.email || 'no-reply@innsight.local',
      phone: data.phone || null,
      address: data.address || null,
      branding: normalizeJson(data.branding) ?? undefined,
      taxSettings: normalizeJson(data.taxSettings) ?? undefined,
      subscriptionStatus: data.subscriptionStatus || 'active',
      updatedAt,
    },
    create: {
      id: tenantId,
      name: data.name || 'Untitled Property',
      slug: data.slug || tenantId,
      email: data.email || 'no-reply@innsight.local',
      phone: data.phone || null,
      address: data.address || null,
      branding: normalizeJson(data.branding) ?? undefined,
      taxSettings: normalizeJson(data.taxSettings) ?? undefined,
      subscriptionStatus: data.subscriptionStatus || 'active',
      createdAt,
      updatedAt,
    },
  });
}

async function migrateCategories(tenantId: string) {
  const snapshot = await db.collection('roomCategories').where('tenantId', '==', tenantId).get();
  if (snapshot.empty) return 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    await prisma.roomCategory.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: data.name || doc.id,
        },
      },
      update: {
        description: data.description || null,
        color: data.color || null,
        totalRooms: typeof data.totalRooms === 'number' ? data.totalRooms : null,
      },
      create: {
        id: doc.id,
        tenantId,
        name: data.name || doc.id,
        description: data.description || null,
        color: data.color || null,
        totalRooms: typeof data.totalRooms === 'number' ? data.totalRooms : null,
      },
    });
  }

  return snapshot.size;
}

async function migrateRatePlans(tenantId: string) {
  const snapshot = await db.collection('ratePlans').where('tenantId', '==', tenantId).get();
  if (snapshot.empty) return 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const baseRate = toDecimal(data.baseRate) ?? new Prisma.Decimal(0);
    let categoryId = data.categoryId || null;

    if (categoryId) {
      const categoryExists = await prisma.roomCategory.findUnique({ where: { id: categoryId } });
      if (!categoryExists) {
        console.warn(
          `⚠️  Rate plan ${data.name || doc.id} references missing category ${categoryId}. Dropping category reference.`
        );
        categoryId = null;
      }
    }

    await prisma.ratePlan.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: data.name || doc.id,
        },
      },
      update: {
        description: data.description || null,
        baseRate,
        currency: data.currency || 'NGN',
        seasonalRules: normalizeJson(data.seasonalRules) ?? undefined,
        isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
        categoryId,
      },
      create: {
        id: doc.id,
        tenantId,
        name: data.name || doc.id,
        description: data.description || null,
        baseRate,
        currency: data.currency || 'NGN',
        seasonalRules: normalizeJson(data.seasonalRules) ?? undefined,
        isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
        categoryId,
      },
    });
  }

  return snapshot.size;
}

async function migrateRooms(tenantId: string) {
  const snapshot = await db.collection('rooms').where('tenantId', '==', tenantId).get();
  if (snapshot.empty) return 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const roomNumber = data.roomNumber || doc.id;
    const amenities = data.amenities ?? null;
    const customRate = toDecimal(data.customRate);
    const updatedAt = toJsDate(data.updatedAt) ?? new Date();
    const createdAt = toJsDate(data.createdAt) ?? updatedAt;
    let categoryId = data.categoryId || null;
    let ratePlanId = data.ratePlanId || null;

    if (categoryId) {
      const categoryExists = await prisma.roomCategory.findUnique({ where: { id: categoryId } });
      if (!categoryExists) {
        console.warn(
          `⚠️  Room ${roomNumber} references missing category ${categoryId}. Dropping category reference.`
        );
        categoryId = null;
      }
    }

    if (ratePlanId) {
      const ratePlanExists = await prisma.ratePlan.findUnique({ where: { id: ratePlanId } });
      if (!ratePlanExists) {
        console.warn(
          `⚠️  Room ${roomNumber} references missing rate plan ${ratePlanId}. Dropping rate plan reference.`
        );
        ratePlanId = null;
      }
    }

    await prisma.room.upsert({
      where: {
        tenantId_roomNumber: {
          tenantId,
          roomNumber,
        },
      },
      update: {
        roomType: data.roomType || 'Room',
        floor: typeof data.floor === 'number' ? data.floor : null,
        status: data.status || 'available',
        maxOccupancy: typeof data.maxOccupancy === 'number' ? data.maxOccupancy : 1,
        amenities,
        ratePlanId,
        categoryId,
        description: data.description || null,
        customRate,
        lastLogType: data.lastLogType || null,
        lastLogSummary: data.lastLogSummary || null,
        lastLogUserName: data.lastLogUserName || null,
        lastLogAt: toJsDate(data.lastLogAt) || null,
        updatedAt,
      },
      create: {
        id: doc.id,
        tenantId,
        roomNumber,
        roomType: data.roomType || 'Room',
        floor: typeof data.floor === 'number' ? data.floor : null,
        status: data.status || 'available',
        maxOccupancy: typeof data.maxOccupancy === 'number' ? data.maxOccupancy : 1,
        amenities,
        ratePlanId,
        categoryId,
        description: data.description || null,
        customRate,
        lastLogType: data.lastLogType || null,
        lastLogSummary: data.lastLogSummary || null,
        lastLogUserName: data.lastLogUserName || null,
        lastLogAt: toJsDate(data.lastLogAt) || null,
        createdAt,
        updatedAt,
      },
    });
  }

  return snapshot.size;
}

async function migrateTenantInventory(tenantId: string, data: admin.firestore.DocumentData) {
  console.log(`\n➡️  Migrating tenant ${tenantId} (${data.name || 'Unnamed'})`);
  await upsertTenant(tenantId, data);
  const [categories, ratePlans, rooms] = await Promise.all([
    migrateCategories(tenantId),
    migrateRatePlans(tenantId),
    migrateRooms(tenantId),
  ]);
  console.log(`   Categories: ${categories}, Rate plans: ${ratePlans}, Rooms: ${rooms}`);
}

async function migrateAllTenants() {
  const tenantsSnapshot = await db.collection('tenants').get();
  console.log(`Found ${tenantsSnapshot.size} tenant(s) to migrate.`);

  for (const doc of tenantsSnapshot.docs) {
    try {
      await migrateTenantInventory(doc.id, doc.data());
    } catch (error: any) {
      console.error(`❌ Failed to migrate tenant ${doc.id}:`, error);
    }
  }
}

migrateAllTenants()
  .then(() => {
    console.log('\n✅ Migration complete');
  })
  .catch((error) => {
    console.error('Migration failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
