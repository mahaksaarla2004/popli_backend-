const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allConfigs = await prisma.systemConfig.findMany();
  console.log('All SystemConfig entries:', allConfigs);

  const feeConfig = await prisma.systemConfig.findUnique({
    where: { key: 'PLATFORM_FEE_PERCENTAGE' },
  });
  console.log('PLATFORM_FEE_PERCENTAGE:', feeConfig);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());