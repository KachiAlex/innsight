import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Creating admin account...');

  // Find or create IITECH tenant
  let iitechTenant = await prisma.tenant.findUnique({
    where: { slug: 'iitech' },
  });

  if (!iitechTenant) {
    console.log('📦 Creating IITECH tenant...');
    iitechTenant = await prisma.tenant.create({
      data: {
        name: 'IITECH Platform',
        slug: 'iitech',
        email: 'admin@iitech.com',
        phone: '+2341234567890',
        subscriptionStatus: 'active',
      },
    });
    console.log('✅ Created IITECH tenant');
  } else {
    console.log('✅ Found existing IITECH tenant');
  }

  // Create admin user
  const passwordHash = await bcrypt.hash('admin123', 12);
  
  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: iitechTenant.id,
        email: 'admin@insight.com',
      },
    },
    update: {
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'iitech_admin',
      isActive: true,
    },
    create: {
      tenantId: iitechTenant.id,
      email: 'admin@insight.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'iitech_admin',
      isActive: true,
    },
  });

  console.log('\n✅ Admin account created successfully!');
  console.log('\n📝 Login Credentials:');
  console.log('   Email: admin@insight.com');
  console.log('   Password: admin123');
  console.log('   Role: iitech_admin');
  console.log(`   Tenant: ${iitechTenant.name} (${iitechTenant.slug})`);
}

main()
  .catch((e) => {
    console.error('❌ Failed to create admin account:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

