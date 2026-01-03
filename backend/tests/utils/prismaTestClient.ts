import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL or TEST_DATABASE_URL must be defined for tests');
}

export const prismaTestClient = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

export type PrismaTestClient = typeof prismaTestClient;
