const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({ include: { likes: true } });
  for (const user of users) {
    if (user.likes.length > 0) {
      console.log(`User: ${user.username} has ${user.likes.length} likes.`);
    }
  }
}
check().catch(console.error).finally(() => prisma.$disconnect());
