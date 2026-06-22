const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { id: '4abbcdd1-671b-40e7-a8ba-a8a1bf910428' },
    select: { id: true, phone: true, username: true, name: true },
  });
  console.log(user);

  const wallet = await prisma.wallet.findUnique({
    where: { userId: '4abbcdd1-671b-40e7-a8ba-a8a1bf910428' },
  });
  console.log('Wallet:', wallet);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());