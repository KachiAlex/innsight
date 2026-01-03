import { prismaTestClient } from './prismaTestClient';

interface TableRecord {
  tablename: string;
}

export const truncateAllTables = async () => {
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
  await prismaTestClient.$disconnect();
};
