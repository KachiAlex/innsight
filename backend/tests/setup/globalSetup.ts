import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface JestGlobalConfig {
  testDatabaseUrl: string;
}

const rootDir = path.resolve(__dirname, '../..');

const runPrismaCommand = (command: string, env: NodeJS.ProcessEnv) => {
  execSync(command, {
    cwd: rootDir,
    stdio: 'inherit',
    env,
  });
};

const ensureTestDatabase = () => {
  const { TEST_DATABASE_URL, DATABASE_URL } = process.env;
  const url = TEST_DATABASE_URL || DATABASE_URL;

  if (!TEST_DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL must be set in your environment for integration tests.'
    );
  }

  if (!url) {
    throw new Error(
      'No database URL found. Set TEST_DATABASE_URL (preferred) or DATABASE_URL.'
    );
  }

  process.env.DATABASE_URL = url;
  return url;
};

const applyMigrations = (env: NodeJS.ProcessEnv) => {
  runPrismaCommand('npx prisma migrate deploy --schema prisma/schema.prisma', env);
};

export default async function globalSetup() {
  const testDatabaseUrl = ensureTestDatabase();
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDatabaseUrl,
  };

  applyMigrations(env);

  (globalThis as any).__JEST_GLOBAL_CONFIG__ = {
    testDatabaseUrl,
  } as JestGlobalConfig;
}
