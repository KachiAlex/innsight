import * as admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const [key, rawValue] = token.split('=', 2);

    if (rawValue !== undefined) {
      args.set(key, rawValue);
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      i += 1;
      continue;
    }

    args.set(key, true);
  }

  const dryRun = Boolean(args.get('--dry-run'));
  const useEmulator = Boolean(args.get('--use-emulator'));
  const debug = Boolean(args.get('--debug'));
  const limitRaw = args.get('--limit');
  const limit = typeof limitRaw === 'string' ? Number(limitRaw) : undefined;
  const tenantId = typeof args.get('--tenantId') === 'string' ? String(args.get('--tenantId')) : undefined;

  return {
    dryRun,
    useEmulator,
    debug,
    limit: Number.isFinite(limit) ? limit : undefined,
    tenantId,
  };
}

function disableFirebaseEmulators() {
  // Force real Firebase services by default.
  // Opt into emulator usage with: --use-emulator
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  delete process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
}

function initializeFirebase() {
  try {
    const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'innsight-2025';

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
      return;
    }

    // Use Application Default Credentials (recommended for local scripts)
    // Requires: `gcloud auth application-default login`
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
  } catch (error: any) {
    if (error?.code !== 'app/already-initialized') {
      throw error;
    }
  }
}

function getProjectId() {
  return process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'innsight-2025';
}

function getEmulatorEnv() {
  return {
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? null,
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST ?? null,
    FIREBASE_DATABASE_EMULATOR_HOST: process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? null,
    FIREBASE_STORAGE_EMULATOR_HOST: process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? null,
  };
}

type RoomServiceOrderDoc = {
  tenantId: string;
  orderNumber?: string;
  status?: string;
  orderType?: string;
  guestId?: string | null;
  guestName?: string;
  roomNumber?: string;
  guestPhone?: string | null;
  subtotal?: any;
  taxAmount?: any;
  serviceCharge?: any;
  totalAmount?: any;
  requestedAt?: Date;
  confirmedAt?: Date | null;
  deliveredAt?: Date | null;
  createdBy?: string | null;
  updatedAt?: Date;
};

function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (typeof value?.toNumber === 'function') return value.toNumber();
  return Number(value);
}

function toFsTimestamp(value: Date | null | undefined) {
  return value ? admin.firestore.Timestamp.fromDate(value) : null;
}

async function main() {
  const { dryRun, limit, tenantId, useEmulator, debug } = parseArgs(process.argv);

  if (!useEmulator) {
    disableFirebaseEmulators();
  }

  initializeFirebase();
  const db = admin.firestore();
  try {
    // Avoid gRPC flakiness in some Windows setups (fallback to REST transport)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).settings?.({ preferRest: true });
  } catch {
    // ignore
  }

  console.log('Backfill: order journals');
  console.log(`dryRun=${dryRun}`);
  console.log(`useEmulator=${useEmulator}`);
  console.log(`projectId=${getProjectId()}`);
  if (typeof limit === 'number') console.log(`limit=${limit}`);
  if (tenantId) console.log(`tenantId=${tenantId}`);

  if (debug) {
    const emulatorEnv = getEmulatorEnv();
    console.log('debug=true');
    console.log(`emulatorEnv=${JSON.stringify(emulatorEnv)}`);
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. This backfill expects RoomServiceOrder records in Postgres. ' +
        'Set DATABASE_URL in your environment (or backend/.env) and retry.'
    );
  }

  const prisma = new PrismaClient();
  let orders: Array<{ id: string } & RoomServiceOrderDoc> = [];
  try {
    orders = (await prisma.roomServiceOrder.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { requestedAt: 'desc' },
      take: typeof limit === 'number' ? limit : undefined,
    })) as any;
  } finally {
    await prisma.$disconnect();
  }

  if (debug) {
    console.log(`postgresOrdersCount=${orders.length}`);
    console.log(`postgresHasTenantFilter=${Boolean(tenantId)}`);
    if (orders[0]) {
      console.log(`postgresSampleOrderId=${(orders[0] as any).id}`);
      console.log(`postgresSampleTenantId=${(orders[0] as any).tenantId}`);
    }
  }

  let processed = 0;
  let created = 0;
  let skippedExisting = 0;
  let skippedInvalid = 0;

  const writes: Array<() => Promise<void>> = [];

  for (const order of orders) {
    const data = order as any as RoomServiceOrderDoc;
    processed += 1;

    if (!data?.tenantId) {
      skippedInvalid += 1;
      continue;
    }

    const journalDocId = `${data.tenantId}_${(order as any).id}`;
    const journalRef = db.collection('order_journals').doc(journalDocId);
    const existing = await journalRef.get();
    if (existing.exists) {
      skippedExisting += 1;
      continue;
    }

    const now = admin.firestore.Timestamp.now();

    const journalDoc = {
      tenantId: data.tenantId,
      source: 'room_service',
      orderId: (order as any).id,
      orderNumber: data.orderNumber ?? null,
      status: data.status ?? null,
      orderType: data.orderType ?? null,
      guestId: data.guestId ?? null,
      guestName: data.guestName ?? null,
      roomNumber: data.roomNumber ?? null,
      amounts: {
        subtotal: toNumber(data.subtotal),
        taxAmount: toNumber(data.taxAmount),
        serviceCharge: toNumber(data.serviceCharge),
        totalAmount: toNumber(data.totalAmount),
      },
      timestamps: {
        requestedAt: toFsTimestamp(data.requestedAt),
        confirmedAt: toFsTimestamp(data.confirmedAt),
        deliveredAt: toFsTimestamp(data.deliveredAt),
      },
      createdAt: now,
      updatedAt: now,
      backfilledAt: now,
    };

    if (!dryRun) {
      const write = async () => {
        await journalRef.set(journalDoc, { merge: false });
      };
      writes.push(write);
    }

    created += 1;
  }

  if (!dryRun && writes.length > 0) {
    const chunkSize = 50;
    for (let i = 0; i < writes.length; i += chunkSize) {
      const chunk = writes.slice(i, i + chunkSize);
      await Promise.all(chunk.map((fn) => fn()));
    }
  }

  console.log('Done.');
  console.log(`processed=${processed}`);
  console.log(`created=${created}${dryRun ? ' (dry-run)' : ''}`);
  console.log(`skippedExisting=${skippedExisting}`);
  console.log(`skippedInvalid=${skippedInvalid}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
