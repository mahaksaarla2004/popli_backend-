const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const reels = await prisma.reel.findMany({ select: { id: true, mediaUrl: true }, take: 10 });
  console.log(reels);
}
main().finally(() => prisma.$disconnect());
