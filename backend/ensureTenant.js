const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  await prisma.tenant.upsert({
    where: { id: 'O9W98cPvgSQiNmfyfkKk' },
    update: {},
    create: {
      id: 'O9W98cPvgSQiNmfyfkKk',
      name: 'Default Tenant',
      slug: 'illuminate',
      email: 'info@iitechsolutions.com.ng',
    },
  });
  console.log('Tenant ensured');
  await prisma.$disconnect();
})().catch((err) => {
  console.error('Failed to ensure tenant', err);
  return prisma.$disconnect();
});
