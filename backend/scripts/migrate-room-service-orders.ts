import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { PrismaClient, Prisma } from '@prisma/client';

interface CliOptions {
  tenantId?: string;
  limit?: number;
  dryRun: boolean;
}

const prisma = new PrismaClient();

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = { dryRun: false };

  args.forEach(arg => {
    if (arg.startsWith('--tenantId=')) {
      options.tenantId = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      options.limit = Number(arg.split('=')[1]);
    } else if (arg === '--dry-run' || arg === '--dryrun') {
      options.dryRun = true;
    }
  });

  return options;
}

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
const firestore = admin.firestore();

const toDate = (
  value: admin.firestore.Timestamp | Date | string | null | undefined
): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof admin.firestore.Timestamp) return value.toDate();
  if (typeof value === 'string') return new Date(value);
  return null;
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
};

async function migrateOrder(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
  dryRun: boolean
) {
  const data = doc.data() || {};
  const orderId = doc.id;

  if (!data.tenantId) {
    console.warn(`Skipping order ${orderId} - missing tenantId`);
    return { skipped: true, orderId };
  }

  const orderPayload: Prisma.RoomServiceOrderUncheckedCreateInput = {
    id: orderId,
    tenantId: data.tenantId,
    orderNumber: data.orderNumber ?? orderId,
    guestId: data.guestId ?? null,
    guestName: data.guestName ?? 'Guest',
    roomNumber: data.roomNumber ?? 'unknown',
    guestPhone: data.guestPhone ?? null,
    status: data.status ?? 'pending',
    orderType: data.orderType ?? 'room_service',
    specialInstructions: data.specialInstructions ?? null,
    estimatedDelivery: toDate(data.estimatedDelivery),
    subtotal: new Prisma.Decimal(toNumber(data.subtotal)),
    taxAmount: new Prisma.Decimal(toNumber(data.taxAmount)),
    serviceCharge: new Prisma.Decimal(toNumber(data.serviceCharge)),
    totalAmount: new Prisma.Decimal(toNumber(data.totalAmount)),
    deliveredAt: toDate(data.deliveredAt),
    deliveredBy: data.deliveredBy ?? null,
    deliveryNotes: data.deliveryNotes ?? null,
    assignedTo: data.assignedTo ?? null,
    preparedAt: toDate(data.preparedAt),
    requestedAt: toDate(data.requestedAt) ?? new Date(),
    confirmedAt: toDate(data.confirmedAt),
    createdBy: data.createdBy ?? null,
    updatedAt: toDate(data.updatedAt) ?? new Date(),
  };

  const itemsSnapshot = await firestore.collection('room_service_order_items')
    .where('orderId', '==', orderId)
    .where('tenantId', '==', data.tenantId)
    .get();

  const itemsPayload: Prisma.RoomServiceOrderItemUncheckedCreateInput[] = itemsSnapshot.docs.map(itemDoc => {
    const itemData = itemDoc.data();
    return {
      id: itemDoc.id,
      tenantId: data.tenantId,
      orderId,
      menuItemId: itemData.menuItemId ?? '',
      quantity: toNumber(itemData.quantity, 1),
      unitPrice: new Prisma.Decimal(toNumber(itemData.unitPrice)),
      totalPrice: new Prisma.Decimal(toNumber(itemData.totalPrice)),
      specialRequests: itemData.specialRequests ?? null,
      status: itemData.status ?? 'pending',
      preparedAt: toDate(itemData.preparedAt),
    };
  });

  if (dryRun) {
    console.log(`[dry-run] Would migrate order ${orderId} with ${itemsPayload.length} items`);
    return { skipped: false, orderId };
  }

  await prisma.roomServiceOrder.upsert({
    where: { id: orderId },
    update: orderPayload,
    create: orderPayload,
  });

  if (itemsPayload.length > 0) {
    await prisma.roomServiceOrderItem.deleteMany({ where: { orderId } });
    await prisma.roomServiceOrderItem.createMany({ data: itemsPayload, skipDuplicates: true });
  }

  return { skipped: false, orderId };
}

async function main() {
  const { tenantId, limit, dryRun } = parseArgs();

  let query: FirebaseFirestore.Query = firestore.collection('room_service_orders');
  if (tenantId) {
    query = query.where('tenantId', '==', tenantId);
  }

  const snapshot = await query.get();
  console.log(`Found ${snapshot.size} orders in Firestore${tenantId ? ` for tenant ${tenantId}` : ''}.`);

  let processed = 0;
  for (const doc of snapshot.docs) {
    if (typeof limit === 'number' && processed >= limit) break;
    await migrateOrder(doc, dryRun);
    processed += 1;
  }

  console.log(`Processed ${processed} orders${dryRun ? ' (dry-run)' : ''}.`);
}

main()
  .catch(err => {
    console.error('Room service order migration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
