const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { id: 'c31a6388-7a69-4a1d-b7e8-38953b1ffbf0' },
    select: { id: true, phone: true, isProfileComplete: true },
  });
  console.log('User:', user);

  const wallet = await prisma.wallet.findUnique({
    where: { userId: 'c31a6388-7a69-4a1d-b7e8-38953b1ffbf0' },
  });
  console.log('Wallet:', wallet);
}

main().catch(console.error).finally(() => prisma.$disconnect());