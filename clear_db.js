const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database (Option 2)...');
  const deletedUsers = await prisma.user.deleteMany({
    where: { role: { not: 'ADMIN' } }
  });
  console.log('Successfully deleted ' + deletedUsers.count + ' users and all their associated data (Reels, Comments, etc).');
}

main().catch(console.error).finally(() => prisma.$disconnect());
