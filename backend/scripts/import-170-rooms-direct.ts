#!/usr/bin/env tsx

/**
 * Direct import of 170 rooms to PostgreSQL (no CSV needed)
 */

import { PrismaClient } from '@prisma/client';

// Initialize Prisma
const prisma = new PrismaClient({
  log: ['error'],
});

async function import170Rooms() {
  console.log('🚀 Starting direct import of 170 rooms...');

  try {
    // Test database connection
    console.log('📋 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Find the illuminate tenant
    console.log('📋 Finding Illuminate tenant...');
    const tenant = await prisma.tenant.findUnique({
      where: { slug: 'illuminate' },
    });

    if (!tenant) {
      throw new Error('Illuminate tenant not found. Run quick-setup first.');
    }

    console.log(`✅ Found tenant: ${tenant.name}`);

    // Get room categories and rate plans
    console.log('📋 Getting room categories and rate plans...');
    const categories = await prisma.roomCategory.findMany({
      where: { tenantId: tenant.id },
    });

    const ratePlans = await prisma.ratePlan.findMany({
      where: { tenantId: tenant.id },
    });

    if (categories.length === 0 || ratePlans.length === 0) {
      throw new Error('No room categories or rate plans found. Run quick-setup first.');
    }

    const standardCategory = categories.find(c => c.name.toLowerCase().includes('standard')) || categories[0];
    const standardRatePlan = ratePlans.find(rp => rp.name.toLowerCase().includes('standard')) || ratePlans[0];

    console.log(`✅ Using category: ${standardCategory.name}, rate plan: ${standardRatePlan.name}`);

    // Generate rooms directly
    console.log('📋 Generating and importing 170 rooms...');
    let imported = 0;
    let skipped = 0;
    let roomId = 101;
    
    // Generate rooms for floors 1-10 (17 rooms per floor = 170 rooms)
    for (let floor = 1; floor <= 10; floor++) {
      for (let roomNum = 1; roomNum <= 17; roomNum++) {
        const roomNumber = `${floor}${roomNum.toString().padStart(2, '0')}`;
        let roomType, rate, maxOccupancy, amenities;
        
        // Assign room types based on floor and room number
        if (floor <= 3) {
          // Floors 1-3: Standard rooms
          roomType = 'Standard';
          rate = 15000 + (floor * 1000); // 16k, 17k, 18k
          maxOccupancy = 2;
          amenities = ['bed', 'tv', 'ac', 'wifi'];
        } else if (floor <= 6) {
          // Floors 4-6: Deluxe rooms
          roomType = 'Deluxe';
          rate = 20000 + (floor * 1000); // 24k, 25k, 26k
          maxOccupancy = 2;
          amenities = ['bed', 'tv', 'ac', 'wifi', 'minibar', 'safe'];
        } else if (floor <= 8) {
          // Floors 7-8: Executive rooms
          roomType = 'Executive';
          rate = 28000 + (floor * 1000); // 35k, 36k
          maxOccupancy = 3;
          amenities = ['bed', 'tv', 'ac', 'wifi', 'minibar', 'safe', 'sofa', 'desk'];
        } else {
          // Floors 9-10: Suite rooms
          roomType = 'Suite';
          rate = 40000 + (floor * 2000); // 58k, 60k
          maxOccupancy = 4;
          amenities = ['bed', 'tv', 'ac', 'wifi', 'minibar', 'safe', 'sofa', 'desk', 'kitchenette'];
        }
        
        // Add some premium rooms on each floor
        if (roomNum === 17) {
          roomType = 'Premium ' + roomType;
          rate += 5000;
          amenities.push('premium_view', 'bathrobe');
        }

        try {
          // Check if room already exists
          const existingRoom = await prisma.room.findFirst({
            where: {
              tenantId: tenant.id,
              roomNumber: roomNumber,
            },
          });

          if (existingRoom) {
            console.log(`⚠️  Room ${roomNumber} already exists, skipping...`);
            skipped++;
            continue;
          }

          // Create room
          await prisma.room.create({
            data: {
              tenantId: tenant.id,
              roomNumber,
              roomType,
              floor,
              status: 'available',
              categoryId: standardCategory.id,
              ratePlanId: standardRatePlan.id,
              customRate: rate,
              maxOccupancy,
              description: `${roomType} room ${roomNumber} on floor ${floor}`,
              amenities,
            },
          });

          console.log(`✅ Imported room: ${roomNumber} (${roomType}) - ₦${rate.toLocaleString()}`);
          imported++;

        } catch (error) {
          console.error(`❌ Failed to import room ${roomNumber}:`, error);
        }
        
        roomId++;
      }
    }

    console.log('');
    console.log('🎉 Room import completed!');
    console.log('');
    console.log('📊 Import Summary:');
    console.log(`- Total rooms generated: 170`);
    console.log(`- Successfully imported: ${imported}`);
    console.log(`- Skipped (already exist): ${skipped}`);
    console.log(`- Failed: ${170 - imported - skipped}`);
    console.log('');
    console.log('✅ You can now login and see all 170 rooms in the system!');
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log('Email: michel@iitechsolutions.com.ng');
    console.log('Password: temp123');

  } catch (error) {
    console.error('❌ Room import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
if (require.main === module) {
  import170Rooms()
    .then(() => {
      console.log('✅ Room import completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Room import failed:', error);
      process.exit(1);
    });
}

export { import170Rooms };
