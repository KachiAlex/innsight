import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const tenantId = 'O9W98cPvgSQiNmfyfkKk';

const categoryDefinitions = [
  {
    name: 'Deluxe',
    description: 'Spacious rooms with king beds and workspace setup.',
    color: '#c084fc',
  },
  {
    name: 'Superior',
    description: 'Comfortable rooms for small families with lounge area.',
    color: '#38bdf8',
  },
  {
    name: 'Executive Suite',
    description: 'Premium suites with dedicated living space and concierge.',
    color: '#f97316',
  },
];

const ratePlanDefinitions = [
  {
    name: 'Deluxe Flex',
    baseRate: 80000,
    currency: 'NGN',
    categoryName: 'Deluxe',
  },
  {
    name: 'Superior Leisure',
    baseRate: 70000,
    currency: 'NGN',
    categoryName: 'Superior',
  },
  {
    name: 'Executive Premium',
    baseRate: 100000,
    currency: 'NGN',
    categoryName: 'Executive Suite',
  },
];

const roomDefinitions = [
  {
    roomNumber: '101',
    roomType: 'Deluxe King',
    floor: 1,
    maxOccupancy: 2,
    status: 'available',
    amenities: ['WiFi', 'Smart TV', 'Workspace'],
    customRate: 78000,
    categoryName: 'Deluxe',
    ratePlanName: 'Deluxe Flex',
  },
  {
    roomNumber: '102',
    roomType: 'Deluxe Double',
    floor: 1,
    maxOccupancy: 3,
    status: 'available',
    amenities: ['WiFi', 'TV', 'Mini fridge'],
    customRate: 76000,
    categoryName: 'Deluxe',
    ratePlanName: 'Deluxe Flex',
  },
  {
    roomNumber: '201',
    roomType: 'Superior Double',
    floor: 2,
    maxOccupancy: 3,
    status: 'available',
    amenities: ['WiFi', 'TV', 'Balcony'],
    customRate: 72000,
    categoryName: 'Superior',
    ratePlanName: 'Superior Leisure',
  },
  {
    roomNumber: '202',
    roomType: 'Superior Twin',
    floor: 2,
    maxOccupancy: 3,
    status: 'available',
    amenities: ['WiFi', 'TV'],
    customRate: 70000,
    categoryName: 'Superior',
    ratePlanName: 'Superior Leisure',
  },
  {
    roomNumber: '301',
    roomType: 'Executive Suite',
    floor: 3,
    maxOccupancy: 4,
    status: 'available',
    amenities: ['WiFi', 'TV', 'Mini bar', 'Butler service'],
    customRate: 110000,
    categoryName: 'Executive Suite',
    ratePlanName: 'Executive Premium',
  },
];

async function main() {
  console.log('Seeding tenant inventory for', tenantId);

  const categoryIdMap = new Map<string, string>();
  for (const category of categoryDefinitions) {
    const record = await prisma.roomCategory.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: category.name,
        },
      },
      update: {
        description: category.description,
        color: category.color,
      },
      create: {
        tenantId,
        name: category.name,
        description: category.description,
        color: category.color,
      },
    });
    categoryIdMap.set(category.name, record.id);
  }
  console.log(`Ensured ${categoryIdMap.size} categories.`);

  const ratePlanIdMap = new Map<string, string>();
  for (const ratePlan of ratePlanDefinitions) {
    const categoryId = ratePlan.categoryName ? categoryIdMap.get(ratePlan.categoryName) : null;
    const record = await prisma.ratePlan.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: ratePlan.name,
        },
      },
      update: {
        baseRate: new Prisma.Decimal(ratePlan.baseRate),
        currency: ratePlan.currency,
        categoryId,
        isActive: true,
      },
      create: {
        tenantId,
        name: ratePlan.name,
        baseRate: new Prisma.Decimal(ratePlan.baseRate),
        currency: ratePlan.currency,
        categoryId,
        isActive: true,
      },
    });
    ratePlanIdMap.set(ratePlan.name, record.id);
  }
  console.log(`Ensured ${ratePlanIdMap.size} rate plans.`);

  let createdRooms = 0;
  for (const room of roomDefinitions) {
    const categoryId = room.categoryName ? categoryIdMap.get(room.categoryName) ?? null : null;
    const ratePlanId = room.ratePlanName ? ratePlanIdMap.get(room.ratePlanName) ?? null : null;

    await prisma.room.upsert({
      where: {
        tenantId_roomNumber: {
          tenantId,
          roomNumber: room.roomNumber,
        },
      },
      update: {
        roomType: room.roomType,
        floor: room.floor,
        maxOccupancy: room.maxOccupancy,
        status: room.status,
        amenities: room.amenities as Prisma.InputJsonValue,
        customRate: new Prisma.Decimal(room.customRate),
        categoryId,
        ratePlanId,
      },
      create: {
        tenantId,
        roomNumber: room.roomNumber,
        roomType: room.roomType,
        floor: room.floor,
        maxOccupancy: room.maxOccupancy,
        status: room.status,
        amenities: room.amenities as Prisma.InputJsonValue,
        customRate: new Prisma.Decimal(room.customRate),
        categoryId,
        ratePlanId,
      },
    });
    createdRooms += 1;
  }

  const totalRooms = await prisma.room.count({ where: { tenantId } });
  console.log(`Seeded/updated ${createdRooms} rooms. Tenant now has ${totalRooms} rooms.`);
}

main()
  .catch((error) => {
    console.error('Failed to seed tenant inventory:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
