// Prisma is optional - only used if DATABASE_URL is set
// Check if DATABASE_URL is available
const hasDatabaseUrl = !!process.env.DATABASE_URL;

let PrismaClient: any = null;
let prismaInstance: any = null;

// Initialize Prisma client synchronously for ESM compatibility
if (hasDatabaseUrl) {
  try {
    // Use require for Node.js compatibility (works in ESM with esbuild)
    const prismaModule = require('@prisma/client');
    PrismaClient = prismaModule.PrismaClient;
    
    if (PrismaClient) {
      prismaInstance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      });
    }
  } catch (e) {
    // Prisma not available
    console.error('Failed to initialize Prisma:', e);
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: any | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaInstance;

if (process.env.NODE_ENV !== 'production' && hasDatabaseUrl) {
  globalForPrisma.prisma = prisma;
}

// Helper to check if Prisma is available
export const isPrismaAvailable = () => {
  return hasDatabaseUrl && prisma !== null;
};
