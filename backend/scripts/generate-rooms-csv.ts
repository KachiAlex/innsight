#!/usr/bin/env tsx

/**
 * Generate 170 rooms CSV for Illuminate Hotel
 */

import fs from 'fs';
import path from 'path';

function generateRoomsCSV() {
  const rooms = [];
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
        amenities = '["bed","tv","ac","wifi"]';
      } else if (floor <= 6) {
        // Floors 4-6: Deluxe rooms
        roomType = 'Deluxe';
        rate = 20000 + (floor * 1000); // 24k, 25k, 26k
        maxOccupancy = 2;
        amenities = '["bed","tv","ac","wifi","minibar","safe"]';
      } else if (floor <= 8) {
        // Floors 7-8: Executive rooms
        roomType = 'Executive';
        rate = 28000 + (floor * 1000); // 35k, 36k
        maxOccupancy = 3;
        amenities = '["bed","tv","ac","wifi","minibar","safe","sofa","desk"]';
      } else {
        // Floors 9-10: Suite rooms
        roomType = 'Suite';
        rate = 40000 + (floor * 2000); // 58k, 60k
        maxOccupancy = 4;
        amenities = '["bed","tv","ac","wifi","minibar","safe","sofa","desk","kitchenette"]';
      }
      
      // Add some premium rooms on each floor
      if (roomNum === 17) {
        roomType = 'Premium ' + roomType;
        rate += 5000;
        amenities = JSON.stringify(JSON.parse(amenities).concat(['premium_view', 'bathrobe']));
      } else {
        amenities = JSON.stringify(amenities);
      }
      
      rooms.push({
        roomNumber,
        roomType,
        floor,
        status: 'available',
        categoryId: '', // Will be filled during import
        ratePlanId: '', // Will be filled during import
        customRate: rate,
        maxOccupancy,
        description: `${roomType} room ${roomNumber} on floor ${floor}`,
        amenities: JSON.stringify(amenities)
      });
      
      roomId++;
    }
  }
  
  return rooms;
}

function writeCSV(rooms: any[]) {
  const headers = ['roomNumber', 'roomType', 'floor', 'status', 'categoryId', 'ratePlanId', 'customRate', 'maxOccupancy', 'description', 'amenities'];
  
  const csvContent = [
    headers.join(','),
    ...rooms.map(room => 
      headers.map(header => {
        const value = room[header];
        if (typeof value === 'string' && (header === 'description' || header === 'amenities')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  const filePath = path.join(__dirname, '../rooms-170.csv');
  fs.writeFileSync(filePath, csvContent);
  
  console.log(`✅ Generated ${rooms.length} rooms CSV file: ${filePath}`);
  console.log(`📊 Room distribution:`);
  
  const distribution = rooms.reduce((acc, room) => {
    acc[room.roomType] = (acc[room.roomType] || 0) + 1;
    return acc;
  }, {});
  
  Object.entries(distribution).forEach(([type, count]) => {
    console.log(`- ${type}: ${count} rooms`);
  });
}

// Generate the CSV
const rooms = generateRoomsCSV();
writeCSV(rooms);

console.log('\n🎯 Next steps:');
console.log('1. Review the generated rooms-170.csv file');
console.log('2. Run: npm run import:rooms');
console.log('3. This will import all 170 rooms to your Illuminate tenant');
