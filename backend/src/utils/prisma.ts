import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Check if DATABASE_URL is available
const hasDatabaseUrl = !!process.env.DATABASE_URL;

export const prisma = globalForPrisma.prisma ?? (hasDatabaseUrl ? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
}) : null as any);

if (process.env.NODE_ENV !== 'production' && hasDatabaseUrl) {
  globalForPrisma.prisma = prisma;
}

// Helper to check if Prisma is available
export const isPrismaAvailable = () => {
  return hasDatabaseUrl && prisma !== null;
};
