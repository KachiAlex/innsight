const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedRooms() {
  const tenantId = 'O9W98cPvgSQiNmfyfkKk';
  const rooms = [
    {
      roomNumber: '101',
      roomType: 'Deluxe King',
      floor: 1,
      maxOccupancy: 2,
      status: 'available',
      amenities: ['WiFi', 'TV', 'AC'],
      customRate: 75000,
      ratePlan: {
        create: {
          tenantId,
          name: 'Deluxe King Plan',
          currency: 'NGN',
          baseRate: 80000,
          isActive: true,
        },
      },
    },
    {
      roomNumber: '102',
      roomType: 'Superior Double',
      floor: 1,
      maxOccupancy: 3,
      status: 'available',
      amenities: ['WiFi', 'TV'],
      customRate: 68000,
      ratePlan: {
        create: {
          tenantId,
          name: 'Superior Double Plan',
          currency: 'NGN',
          baseRate: 70000,
          isActive: true,
        },
      },
    },
    {
      roomNumber: '201',
      roomType: 'Executive Suite',
      floor: 2,
      maxOccupancy: 4,
      status: 'available',
      amenities: ['WiFi', 'TV', 'Mini Bar'],
      customRate: 95000,
      ratePlan: {
        create: {
          tenantId,
          name: 'Executive Suite Plan',
          currency: 'NGN',
          baseRate: 100000,
          isActive: true,
        },
      },
    },
  ];

  try {
    for (const room of rooms) {
      await prisma.room.create({
        data: {
          tenantId,
          ...room,
        },
      });
    }
    console.log('Seeded sample rooms successfully.');
  } catch (error) {
    console.error('Error seeding rooms:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedRooms();
