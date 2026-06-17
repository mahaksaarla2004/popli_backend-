const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const pixabayReels = await prisma.reel.deleteMany({
    where: { mediaUrl: { contains: 'pixabay.com' } }
  });
  console.log(`Deleted ${pixabayReels.count} pixabay reels.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
