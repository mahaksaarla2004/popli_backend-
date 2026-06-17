const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const userId = '8fbb0e8c-ad84-4ea1-aa8f-281c94d6134a'; // From terminal output
  const likes = await prisma.like.findMany({ where: { userId }, include: { reel: true } });
  const history = await prisma.watchHistory.findMany({ where: { userId }, include: { reel: true } });
  console.log('User Likes:', likes.length);
  console.log('User History:', history.length);
}
main().catch(console.error).finally(() => prisma.$disconnect());
