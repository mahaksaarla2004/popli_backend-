const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transaction.findMany({
    where: { walletId: 'd8843846-63bc-40fc-800d-d0319f606b0c' },
    orderBy: { createdAt: 'asc' },
  });
  console.log(JSON.stringify(transactions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());