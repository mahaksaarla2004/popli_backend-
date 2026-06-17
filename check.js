const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('Likes:', await prisma.like.count());
  console.log('WatchHistory:', await prisma.watchHistory.count());
}
main().catch(console.error).finally(() => prisma.$disconnect());
