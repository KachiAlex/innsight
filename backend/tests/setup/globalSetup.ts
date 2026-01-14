import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface JestGlobalConfig {
  testDatabaseUrl: string;
}

const rootDir = path.resolve(__dirname, '../..');
const REQUIRE_DB_FLAG = 'REQUIRE_DB_SETUP';

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

const skipDbSetup = (reason: string) => {
  console.warn(`[jest] Skipping database setup: ${reason}`);
  (globalThis as any).__JEST_GLOBAL_CONFIG__ = {
    testDatabaseUrl: '',
  } as JestGlobalConfig;
};

const normalizeFlag = (value?: string) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};
const shouldRequireDatabase = () => normalizeFlag(process.env[REQUIRE_DB_FLAG]);
const shouldSkipDatabase = () => normalizeFlag(process.env.SKIP_DB_SETUP);

export default async function globalSetup() {
  const skipFlag = process.env.SKIP_DB_SETUP;
  const skipDecision = shouldSkipDatabase();
  console.info(
    `[jest] globalSetup SKIP_DB_SETUP=${skipFlag ?? '<undefined>'} => shouldSkip=${skipDecision}`
  );

  if (skipDecision) {
    skipDbSetup('SKIP_DB_SETUP flag detected');
    return;
  }

  try {
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
  } catch (error: any) {
    const message = error?.message || '';
    const stderr = typeof error?.stderr === 'string' ? error.stderr : error?.stderr?.toString?.() || '';
    const stdout = typeof error?.stdout === 'string' ? error.stdout : error?.stdout?.toString?.() || '';
    const diagnostic = `${message}\n${stderr}\n${stdout}`;
    const connectivityIssue =
      diagnostic.includes('P1001') || diagnostic.includes("Can't reach database server");

    if (
      !shouldRequireDatabase() &&
      (connectivityIssue || diagnostic.includes('No database URL'))
    ) {
      skipDbSetup(
        connectivityIssue
          ? 'unable to reach configured database (P1001)'
          : 'no TEST_DATABASE_URL/DATABASE_URL configured'
      );
      return;
    }

    throw error;
  }
}
