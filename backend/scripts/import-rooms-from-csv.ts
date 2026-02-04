#!/usr/bin/env tsx

/**
 * Import rooms from CSV file to PostgreSQL
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma
const prisma = new PrismaClient({
  log: ['error'],
});

interface RoomData {
  roomNumber: string;
  roomType: string;
  floor: number;
  status: string;
  categoryId: string;
  ratePlanId: string;
  customRate: number;
  maxOccupancy: number;
  description: string;
  amenities: string;
}

async function importRoomsFromCSV() {
  console.log('🚀 Starting rooms import from CSV...');

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

    console.log(`✅ Found ${categories.length} categories and ${ratePlans.length} rate plans`);

    // Read CSV file
    const csvPath = path.join(__dirname, '../rooms-170.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.log('📋 CSV file not found, generating it first...');
      // Generate CSV if it doesn't exist
      const { generateRoomsCSV, writeCSV } = require('./generate-rooms-csv.ts');
      const rooms = generateRoomsCSV();
      writeCSV(rooms);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid');
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const rooms: RoomData[] = [];

    // Parse CSV
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      
      if (values.length !== headers.length) {
        console.warn(`⚠️  Skipping line ${i + 1}: Invalid column count`);
        continue;
      }

      const room: any = {};
      headers.forEach((header, index) => {
        const value = values[index];
        if (header === 'floor' || header === 'customRate' || header === 'maxOccupancy') {
          room[header] = parseInt(value) || 0;
        } else if (header === 'amenities') {
          try {
            room[header] = JSON.parse(value);
          } catch {
            room[header] = [];
          }
        } else {
          room[header] = value;
        }
      });

      rooms.push(room as RoomData);
    }

    console.log(`📊 Parsed ${rooms.length} rooms from CSV`);

    // Assign category and rate plan based on room type
    const standardCategory = categories.find(c => c.name.toLowerCase().includes('standard')) || categories[0];
    const standardRatePlan = ratePlans.find(rp => rp.name.toLowerCase().includes('standard')) || ratePlans[0];

    console.log(`📋 Using category: ${standardCategory.name}, rate plan: ${standardRatePlan.name}`);

    // Import rooms
    console.log('📋 Importing rooms...');
    let imported = 0;
    let skipped = 0;

    for (const roomData of rooms) {
      try {
        // Check if room already exists
        const existingRoom = await prisma.room.findFirst({
          where: {
            tenantId: tenant.id,
            roomNumber: roomData.roomNumber,
          },
        });

        if (existingRoom) {
          console.log(`⚠️  Room ${roomData.roomNumber} already exists, skipping...`);
          skipped++;
          continue;
        }

        // Create room
        await prisma.room.create({
          data: {
            tenantId: tenant.id,
            roomNumber: roomData.roomNumber,
            roomType: roomData.roomType,
            floor: roomData.floor,
            status: roomData.status,
            categoryId: standardCategory.id,
            ratePlanId: standardRatePlan.id,
            customRate: roomData.customRate,
            maxOccupancy: roomData.maxOccupancy,
            description: roomData.description,
            amenities: roomData.amenities,
          },
        });

        console.log(`✅ Imported room: ${roomData.roomNumber} (${roomData.roomType})`);
        imported++;

      } catch (error) {
        console.error(`❌ Failed to import room ${roomData.roomNumber}:`, error);
      }
    }

    console.log('');
    console.log('🎉 Room import completed!');
    console.log('');
    console.log('📊 Import Summary:');
    console.log(`- Total rooms in CSV: ${rooms.length}`);
    console.log(`- Successfully imported: ${imported}`);
    console.log(`- Skipped (already exist): ${skipped}`);
    console.log(`- Failed: ${rooms.length - imported - skipped}`);
    console.log('');
    console.log('✅ You can now login and see all rooms in the system!');

  } catch (error) {
    console.error('❌ Room import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
if (require.main === module) {
  importRoomsFromCSV()
    .then(() => {
      console.log('✅ Room import completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Room import failed:', error);
      process.exit(1);
    });
}

export { importRoomsFromCSV };
