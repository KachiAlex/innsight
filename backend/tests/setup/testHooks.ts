import { prismaTestClient } from '../utils/prismaTestClient';
import { truncateAllTables, disconnectPrisma } from '../utils/db';

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

beforeAll(async () => {
  if (!canUseDatabase) {
    return;
  }

  await prismaTestClient.$connect();
  await truncateAllTables();
});

beforeEach(async () => {
  if (!canUseDatabase) {
    return;
  }

  await truncateAllTables();
});

afterAll(async () => {
  if (!canUseDatabase) {
    return;
  }

  await truncateAllTables();
  await disconnectPrisma();
});
