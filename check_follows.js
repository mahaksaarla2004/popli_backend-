const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const follows = await prisma.follows.findMany({
    include: {
      follower: { select: { username: true } },
      following: { select: { username: true } }
    }
  });
  console.log('Follow relationships:', follows);
}

main().catch(console.error).finally(() => prisma.$disconnect());
