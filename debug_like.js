const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = '8fbb0e8c-ad84-4ea1-aa8f-281c94d6134a'; // From terminal logs
  const reelId = '42c2fc46-681e-4d04-aee8-f968eb483dc3'; // From error screenshot

  try {
    const existingLike = await prisma.like.findUnique({
      where: { reelId_userId: { reelId, userId } },
    });

    if (existingLike) {
      console.log('Existing like found, deleting...');
      await prisma.like.delete({ where: { id: existingLike.id } });
      const reel = await prisma.reel.update({
        where: { id: reelId },
        data: { likesCount: { decrement: 1 } },
      });
      await prisma.user.update({
        where: { id: reel.creatorId },
        data: { totalLikesReceived: { decrement: 1 } },
      });
      console.log('Unliked successfully');
    } else {
      console.log('No existing like found, creating...');
      await prisma.like.create({ data: { reelId, userId } });
      const reel = await prisma.reel.update({
        where: { id: reelId },
        data: { likesCount: { increment: 1 } },
      });
      await prisma.user.update({
        where: { id: reel.creatorId },
        data: { totalLikesReceived: { increment: 1 } },
      });
      console.log('Liked successfully');
    }
  } catch (error) {
    console.error('Error during toggleLike:', error);
  }
}

main().finally(() => prisma.$disconnect());
