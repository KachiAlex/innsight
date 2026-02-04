#!/usr/bin/env tsx

/**
 * Quick Setup: Create Illuminate Tenant and User in PostgreSQL
 * This is a temporary solution to get you working immediately
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

// Initialize Prisma directly for this script
const prisma = new PrismaClient({
  log: ['error'],
});

async function quickSetupIlluminate() {
  console.log('🚀 Quick Setup: Creating Illuminate tenant and user...');

  try {
    // Test database connection
    console.log('📋 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Step 1: Create illuminate tenant
    console.log('📋 Step 1: Creating Illuminate tenant...');
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'illuminate' },
      update: {
        name: 'Illuminate Hotel',
        email: 'admin@illuminate.com',
        phone: '+2341234567890',
        subscriptionStatus: 'active',
        updatedAt: new Date(),
      },
      create: {
        name: 'Illuminate Hotel',
        slug: 'illuminate',
        email: 'admin@illuminate.com',
        phone: '+2341234567890',
        subscriptionStatus: 'active',
      },
    });

    console.log(`✅ Created tenant: ${tenant.name} (${tenant.slug})`);

    // Step 2: Create your user account
    console.log('📋 Step 2: Creating user account...');
    const passwordHash = await hashPassword('temp123'); // Default password

    const user = await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: 'michel@iitechsolutions.com.ng',
        },
      },
      update: {
        firstName: 'Michel',
        lastName: 'User',
        passwordHash,
        role: 'owner',
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        tenantId: tenant.id,
        email: 'michel@iitechsolutions.com.ng',
        firstName: 'Michel',
        lastName: 'User',
        passwordHash,
        role: 'owner',
        isActive: true,
      },
    });

    console.log(`✅ Created user: ${user.email}`);

    // Step 3: Create a sample room category
    console.log('📋 Step 3: Creating sample room category...');
    const category = await prisma.roomCategory.upsert({
      where: { 
        tenantId_name: {
          tenantId: tenant.id,
          name: 'Standard Room'
        }
      },
      update: {
        description: 'Standard room category',
        color: '#3B82F6',
        totalRooms: 50,
        updatedAt: new Date(),
      },
      create: {
        tenantId: tenant.id,
        name: 'Standard Room',
        description: 'Standard room category',
        color: '#3B82F6',
        totalRooms: 50,
      },
    });

    console.log(`✅ Created room category: ${category.name}`);

    // Step 4: Create a sample rate plan
    console.log('📋 Step 4: Creating sample rate plan...');
    const ratePlan = await prisma.ratePlan.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: 'Standard Rate'
        }
      },
      update: {
        description: 'Standard room rate',
        currency: 'NGN',
        baseRate: 15000,
        isActive: true,
        categoryId: category.id,
        updatedAt: new Date(),
      },
      create: {
        tenantId: tenant.id,
        name: 'Standard Rate',
        description: 'Standard room rate',
        currency: 'NGN',
        baseRate: 15000,
        isActive: true,
        categoryId: category.id,
      },
    });

    console.log(`✅ Created rate plan: ${ratePlan.name}`);

    // Step 5: Create a few sample rooms
    console.log('📋 Step 5: Creating sample rooms...');
    for (let i = 1; i <= 5; i++) {
      await prisma.room.upsert({
        where: { 
          tenantId_roomNumber: {
            tenantId: tenant.id,
            roomNumber: `${100 + i}`
          }
        },
        update: {
          roomType: 'Standard',
          floor: 1,
          status: 'available',
          categoryId: category.id,
          ratePlanId: ratePlan.id,
          customRate: 15000,
          maxOccupancy: 2,
          updatedAt: new Date(),
        },
        create: {
          tenantId: tenant.id,
          roomNumber: `${100 + i}`,
          roomType: 'Standard',
          floor: 1,
          status: 'available',
          categoryId: category.id,
          ratePlanId: ratePlan.id,
          customRate: 15000,
          maxOccupancy: 2,
        },
      });
    }

    console.log(`✅ Created 5 sample rooms (101-105)`);

    console.log('');
    console.log('🎉 Quick setup completed successfully!');
    console.log('');
    console.log('📊 Setup Summary:');
    console.log(`- Tenant: ${tenant.name} (${tenant.slug})`);
    console.log(`- User: ${user.email}`);
    console.log(`- Room Category: ${category.name}`);
    console.log(`- Rate Plan: ${ratePlan.name}`);
    console.log(`- Sample Rooms: 5 (101-105)`);
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log(`Email: ${user.email}`);
    console.log(`Password: temp123`);
    console.log('');
    console.log('⚠️  Important:');
    console.log('- Change your password after first login');
    console.log('- You can add more rooms and categories manually');
    console.log('- Use the Firebase migration script later to import all 170 rooms');

  } catch (error) {
    console.error('❌ Quick setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the quick setup
if (require.main === module) {
  quickSetupIlluminate()
    .then(() => {
      console.log('✅ Quick setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Quick setup failed:', error);
      process.exit(1);
    });
}

export { quickSetupIlluminate };
