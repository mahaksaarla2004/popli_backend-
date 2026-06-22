const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const wallets = await prisma.wallet.findMany({
    include: { user: { select: { phone: true, username: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });
  console.log(JSON.stringify(wallets, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());