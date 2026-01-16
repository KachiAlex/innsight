const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const rooms = await prisma.room.findMany({
      where: { tenantId: 'O9W98cPvgSQiNmfyfkKk' },
      select: {
        id: true,
        roomNumber: true,
        roomType: true,
        status: true,
        maxOccupancy: true,
        customRate: true,
        ratePlanId: true,
      },
      take: 5,
    });
    const total = await prisma.room.count({ where: { tenantId: 'O9W98cPvgSQiNmfyfkKk' } });
    console.log('Total rooms:', total);
    console.log('Sample rooms:', rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
