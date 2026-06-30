const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findUnique({ where: { referralCode: 'TZFZ9786' } });
  console.log('User with TZFZ9786:', user ? user.username : 'Not found');
  
  const allUsers = await prisma.user.findMany({ select: { username: true, referralCode: true, referredById: true } });
  console.log('\nAll users and their codes:');
  console.log(allUsers);
  
  const trackers = await prisma.referralTracker.findMany();
  console.log('\nTrackers:', trackers);
  
  const wallets = await prisma.wallet.findMany({ select: { userId: true, withdrawableBalance: true, totalEarnings: true } });
  console.log('\nWallets:', wallets);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
