// Prisma is optional - only used if DATABASE_URL is set
// Check if DATABASE_URL is available
const hasDatabaseUrl = !!process.env.DATABASE_URL;

let PrismaClient: any = null;
try {
  if (hasDatabaseUrl) {
    const prismaModule = require('@prisma/client');
    PrismaClient = prismaModule.PrismaClient;
  }
} catch (e) {
  // Prisma not available, using Firestore only
}

const globalForPrisma = globalThis as unknown as {
  prisma: any | undefined;
};

export const prisma = globalForPrisma.prisma ?? (hasDatabaseUrl && PrismaClient ? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
}) : null as any);

if (process.env.NODE_ENV !== 'production' && hasDatabaseUrl) {
  globalForPrisma.prisma = prisma;
}

// Helper to check if Prisma is available
export const isPrismaAvailable = () => {
  return hasDatabaseUrl && prisma !== null;
};
