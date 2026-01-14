import { prismaTestClient } from './prismaTestClient';

declare global {
  // eslint-disable-next-line no-var
  var __JEST_GLOBAL_CONFIG__:
    | {
        testDatabaseUrl: string;
      }
    | undefined;
}

const shouldSkipDbSetup = process.env.SKIP_DB_SETUP === 'true';
const hasTestDatabaseUrl = Boolean(global.__JEST_GLOBAL_CONFIG__?.testDatabaseUrl);
const canUseDatabase = !shouldSkipDbSetup && hasTestDatabaseUrl;

interface TableRecord {
  tablename: string;
}

export const truncateAllTables = async () => {
  if (!canUseDatabase) {
    return;
  }

  const tables = await prismaTestClient.$queryRaw<TableRecord[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  if (!tables.length) {
    return;
  }

  const tableNames = tables
    .map((table) => `"${table.tablename}"`)
    .join(', ');

  await prismaTestClient.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`
  );
};

export const disconnectPrisma = async () => {
  if (!canUseDatabase) {
    return;
  }
  await prismaTestClient.$disconnect();
};
