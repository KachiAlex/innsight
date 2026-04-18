// Prisma is optional - only used if DATABASE_URL is set
const hasDatabaseUrl = !!process.env.DATABASE_URL;

let PrismaClient = null;
let prismaInstance = null;

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

module.exports = async (req, res) => {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
    console.log('Prisma client initialized:', !!prismaInstance);
    
    if (!prismaInstance) {
      return res.status(500).json({ 
        success: false, 
        error: 'Prisma client failed to initialize',
        hasDatabaseUrl,
        envCheck: {
          DATABASE_URL: !!process.env.DATABASE_URL,
          NODE_ENV: process.env.NODE_ENV
        }
      });
    }
    
    // Try a simple query
    const result = await prismaInstance.$queryRaw`SELECT 1 as test`;
    console.log('Database connection successful:', result);
    
    res.status(200).json({ 
      success: true, 
      message: 'Database connection successful',
      result: result
    });
  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack,
      envCheck: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        NODE_ENV: process.env.NODE_ENV,
        prismaInitialized: !!prismaInstance
      }
    });
  } finally {
    if (prismaInstance) {
      await prismaInstance.$disconnect();
    }
  }
};
