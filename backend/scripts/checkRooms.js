const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({
    take: 20,
    select: {
      id: true,
      tenantId: true,
      roomNumber: true,
      roomType: true,
      status: true,
      maxOccupancy: true,
      categoryId: true,
      ratePlanId: true,
      customRate: true,
    },
  });
  console.log(JSON.stringify(rooms, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
