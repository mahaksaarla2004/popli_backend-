import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.reel.updateMany({
    where: {
      mediaUrl: {
        startsWith: 'file://',
      },
    },
    data: {
      mediaUrl: 'https://cdn.pixabay.com/video/2022/10/30/137119-766160170_large.mp4',
      thumbnailUrl: 'https://cdn.pixabay.com/photo/2023/10/22/18/60/186065-876932450_large.jpg',
    },
  });
  console.log(`Fixed ${result.count} broken reels!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
