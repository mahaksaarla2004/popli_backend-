import { PrismaClient } from '@prisma/client';
import { extractHashtags } from '../utils/hashtags.util';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting hashtag extraction migration...');
  
  const reels = await prisma.reel.findMany({
    where: {
      description: { not: '' }
    },
    select: { id: true, description: true }
  });

  console.log(`Found ${reels.length} reels with descriptions.`);

  let processedCount = 0;

  for (const reel of reels) {
    if (!reel.description) continue;

    const hashtags = extractHashtags(reel.description);
    if (hashtags.length === 0) continue;

    // Remove existing relations just in case this is re-run
    await prisma.reelHashtag.deleteMany({
      where: { reelId: reel.id }
    });

    for (const tag of hashtags) {
      const hashtag = await prisma.hashtag.upsert({
        where: { name: tag },
        update: { 
          usageCount: { increment: 1 },
          recentScore: { increment: 1.5 } 
        },
        create: { 
          name: tag, 
          usageCount: 1,
          recentScore: 1.5
        }
      });

      await prisma.reelHashtag.create({
        data: {
          reelId: reel.id,
          hashtagId: hashtag.id
        }
      });
    }

    processedCount++;
    if (processedCount % 50 === 0) {
      console.log(`Processed ${processedCount} reels...`);
    }
  }

  console.log(`Migration complete! Processed ${processedCount} reels with hashtags.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
