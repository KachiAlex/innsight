import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

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

  console.log('✅ Created IITECH tenant');

  // Create IITECH admin user (admin@iitech.com)
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: iitechTenant.id,
        email: 'admin@iitech.com',
      },
    },
    update: {},
    create: {
      tenantId: iitechTenant.id,
      email: 'admin@iitech.com',
      passwordHash: adminPasswordHash,
      firstName: 'IITECH',
      lastName: 'Admin',
      role: 'iitech_admin',
    },
  });

  console.log('✅ Created IITECH admin user');
  console.log('   Email: admin@iitech.com');
  console.log('   Password: admin123');

  // Create admin@insight.com user
  const insightAdminPasswordHash = await bcrypt.hash('admin123', 12);
  const insightAdminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: iitechTenant.id,
        email: 'admin@insight.com',
      },
    },
    update: {
      passwordHash: insightAdminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'iitech_admin',
      isActive: true,
    },
    create: {
      tenantId: iitechTenant.id,
      email: 'admin@insight.com',
      passwordHash: insightAdminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'iitech_admin',
      isActive: true,
    },
  });

  console.log('✅ Created admin@insight.com user');
  console.log('   Email: admin@insight.com');
  console.log('   Password: admin123');

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

  console.log('✅ Created sample tenant: Grand Hotel');

  // Create owner for Grand Hotel
  const ownerPasswordHash = await bcrypt.hash('password123', 12);
  const owner = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: grandHotel.id,
        email: 'owner@grandhotel.com',
      },
    },
    update: {},
    create: {
      tenantId: grandHotel.id,
      email: 'owner@grandhotel.com',
      passwordHash: ownerPasswordHash,
      firstName: 'John',
      lastName: 'Doe',
      role: 'owner',
    },
  });

  console.log('✅ Created owner user');
  console.log('   Email: owner@grandhotel.com');
  console.log('   Password: password123');

  // Create rate plan
  const ratePlan = await prisma.ratePlan.create({
    data: {
      tenantId: grandHotel.id,
      name: 'Standard Rate',
      description: 'Standard room rate',
      baseRate: 15000,
      currency: 'NGN',
      isActive: true,
    },
  });

  console.log('✅ Created rate plan');

  // Create sample rooms
  const rooms = await Promise.all([
    prisma.room.create({
      data: {
        tenantId: grandHotel.id,
        roomNumber: '101',
        roomType: 'single',
        floor: 1,
        maxOccupancy: 1,
        status: 'available',
        ratePlanId: ratePlan.id,
        amenities: ['wifi', 'tv', 'ac'],
      },
    }),
    prisma.room.create({
      data: {
        tenantId: grandHotel.id,
        roomNumber: '102',
        roomType: 'double',
        floor: 1,
        maxOccupancy: 2,
        status: 'available',
        ratePlanId: ratePlan.id,
        amenities: ['wifi', 'tv', 'ac', 'minibar'],
      },
    }),
    prisma.room.create({
      data: {
        tenantId: grandHotel.id,
        roomNumber: '201',
        roomType: 'suite',
        floor: 2,
        maxOccupancy: 4,
        status: 'available',
        ratePlanId: ratePlan.id,
        amenities: ['wifi', 'tv', 'ac', 'minibar', 'jacuzzi'],
      },
    }),
  ]);

  console.log(`✅ Created ${rooms.length} sample rooms`);

  // Create front desk user
  const frontDeskPasswordHash = await bcrypt.hash('password123', 12);
  await prisma.user.create({
    data: {
      tenantId: grandHotel.id,
      email: 'frontdesk@grandhotel.com',
      passwordHash: frontDeskPasswordHash,
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'front_desk',
    },
  });

  console.log('✅ Created front desk user');
  console.log('   Email: frontdesk@grandhotel.com');
  console.log('   Password: password123');

  console.log('\n🎉 Seeding completed successfully!');
  console.log('\n📝 Login Credentials:');
  console.log('   IITECH Admin: admin@iitech.com / admin123');
  console.log('   Insight Admin: admin@insight.com / admin123');
  console.log('   Hotel Owner: owner@grandhotel.com / password123');
  console.log('   Front Desk: frontdesk@grandhotel.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
