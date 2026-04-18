const { PrismaClient } = require('@prisma/client');

module.exports = async (req, res) => {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
    
    const prisma = new PrismaClient();
    
    // Try a simple query
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Database connection successful:', result);
    
    await prisma.$disconnect();
    
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
        NODE_ENV: process.env.NODE_ENV
      }
    });
  }
};
