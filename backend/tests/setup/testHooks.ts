import { prismaTestClient } from '../utils/prismaTestClient';
import { truncateAllTables, disconnectPrisma } from '../utils/db';

declare global {
  // eslint-disable-next-line no-var
  var __JEST_GLOBAL_CONFIG__: {
    testDatabaseUrl: string;
  };
}

beforeAll(async () => {
  if (!global.__JEST_GLOBAL_CONFIG__?.testDatabaseUrl) {
    throw new Error('Test database URL missing from global config');
  }

  await prismaTestClient.$connect();
  await truncateAllTables();
});

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await truncateAllTables();
  await disconnectPrisma();
});
