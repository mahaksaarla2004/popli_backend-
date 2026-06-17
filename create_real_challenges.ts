import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up old dummy challenges...');
  // Optional: delete the dummy challenge we just created
  await prisma.challenge.deleteMany({
    where: { title: 'Awesome Dance Challenge' }
  });

  console.log('Creating 2 fresh real challenges via Admin...');

  const endDate1 = new Date();
  endDate1.setDate(endDate1.getDate() + 10); // Active for 10 days

  const challenge1 = await prisma.challenge.create({
    data: {
      title: 'Summer Vibes Fashion Show',
      description: 'Showcase your best summer outfits! The most engaged reels win the grand prize.',
      hashtagName: '#PopliSummerFashion',
      bannerUrl: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=600&auto=format&fit=crop',
      rewardPool: 10000,
      startDate: new Date(),
      endDate: endDate1,
      status: 'ACTIVE',
      isSponsored: true,
      sponsorName: 'Popli Fashion',
      sponsorLogoUrl: 'https://ui-avatars.com/api/?name=Popli+Fashion&background=F59E0B&color=fff',
    },
  });

  const endDate2 = new Date();
  endDate2.setDate(endDate2.getDate() + 5);

  const challenge2 = await prisma.challenge.create({
    data: {
      title: 'Lip Sync Battle',
      description: 'Lip sync to your favorite dialogues and songs. Get creative!',
      hashtagName: '#LipSyncBattle',
      bannerUrl: 'https://images.unsplash.com/photo-1516280440502-a2ceb5853f60?q=80&w=600&auto=format&fit=crop',
      rewardPool: 5000,
      startDate: new Date(),
      endDate: endDate2,
      status: 'ACTIVE',
      isSponsored: false,
    },
  });

  console.log('Challenges created successfully!');
  console.log(`1. ${challenge1.title} (ID: ${challenge1.id})`);
  console.log(`2. ${challenge2.title} (ID: ${challenge2.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
