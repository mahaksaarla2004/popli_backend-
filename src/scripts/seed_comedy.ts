import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function updateReels() {
  const reels = await prisma.reel.findMany({ take: 3 });
  for (const reel of reels) {
    const newDescription = (reel.description || '') + ' #comedy #viral';
    await prisma.reel.update({
      where: { id: reel.id },
      data: { description: newDescription },
    });
  }
  console.log('Updated 3 reels with #comedy');
}

updateReels()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
