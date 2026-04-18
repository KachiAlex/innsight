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

const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  // Only allow this in development or with a secret key
  const setupKey = req.query.key || req.headers['x-setup-key'];
  if (setupKey !== process.env.SETUP_KEY && process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    console.log('Seeding database...');
    
    if (!prismaInstance) {
      return res.status(500).json({ 
        success: false, 
        error: 'Prisma client failed to initialize',
        hasDatabaseUrl
      });
    }
    
    await seedDatabase(prismaInstance);
    console.log('Database seeded successfully');

    res.status(200).json({ 
      success: true, 
      message: 'Database seeding completed successfully',
      credentials: {
        admin: 'admin@iitech.com / admin123',
        owner: 'owner@grandhotel.com / password123',
        frontdesk: 'frontdesk@grandhotel.com / password123'
      }
    });
  } catch (error) {
    console.error('Database setup failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Note: Database migrations must be run separately using: npx prisma migrate deploy'
    });
  } finally {
    if (prismaInstance) {
      await prismaInstance.$disconnect();
    }
  }
};

async function seedDatabase(prisma) {
  // Create IITECH tenant
  const iitechTenant = await prisma.tenant.upsert({
    where: { slug: 'iitech' },
    update: {},
    create: {
      name: 'IITECH Platform',
      slug: 'iitech',
      email: 'admin@iitech.com',
      phone: '+2341234567890',
      subscriptionStatus: 'active',
    },
  });

  console.log('Created IITECH tenant');

  // Create IITECH admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: iitechTenant.id,
        email: 'admin@iitech.com',
      },
    },
    update: {
      passwordHash: adminPasswordHash,
      isActive: true,
    },
    create: {
      tenantId: iitechTenant.id,
      email: 'admin@iitech.com',
      passwordHash: adminPasswordHash,
      firstName: 'IITECH',
      lastName: 'Admin',
      role: 'owner',
      isActive: true,
    },
  });

  console.log('Created admin user');

  // Create sample tenant (Grand Hotel)
  const grandHotel = await prisma.tenant.upsert({
    where: { slug: 'grand-hotel' },
    update: {},
    create: {
      name: 'Grand Hotel',
      slug: 'grand-hotel',
      email: 'info@grandhotel.com',
      phone: '+2341234567891',
      address: '123 Main Street, Lagos',
      subscriptionStatus: 'active',
    },
  });

  console.log('Created sample tenant: Grand Hotel');

  // Create owner for Grand Hotel
  const ownerPasswordHash = await bcrypt.hash('password123', 12);
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: grandHotel.id,
        email: 'owner@grandhotel.com',
      },
    },
    update: {
      passwordHash: ownerPasswordHash,
      isActive: true,
    },
    create: {
      tenantId: grandHotel.id,
      email: 'owner@grandhotel.com',
      passwordHash: ownerPasswordHash,
      firstName: 'John',
      lastName: 'Doe',
      role: 'owner',
      isActive: true,
    },
  });

  console.log('Created owner user');

  // Create rate plan
  const ratePlan = await prisma.ratePlan.upsert({
    where: {
      id: grandHotel.id + '-standard'
    },
    update: {},
    create: {
      tenantId: grandHotel.id,
      id: grandHotel.id + '-standard',
      name: 'Standard Rate',
      description: 'Standard room rate',
      baseRate: 15000,
      currency: 'NGN',
      isActive: true,
    },
  });

  console.log('Created rate plan');

  // Create front desk user
  const frontDeskPasswordHash = await bcrypt.hash('password123', 12);
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: grandHotel.id,
        email: 'frontdesk@grandhotel.com',
      },
    },
    update: {
      passwordHash: frontDeskPasswordHash,
      isActive: true,
    },
    create: {
      tenantId: grandHotel.id,
      email: 'frontdesk@grandhotel.com',
      passwordHash: frontDeskPasswordHash,
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'front_desk',
      isActive: true,
    },
  });

  console.log('Created front desk user');
}
