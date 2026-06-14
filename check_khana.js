const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true }
  });
  console.log('All Users:');
  console.log(users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
