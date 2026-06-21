import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding dummy challenge data...');

  // 1. Create 5 dummy users
  const users: any[] = [];
  for (let i = 1; i <= 5; i++) {
    const user = await prisma.user.create({
      data: {
        name: `Test User ${i}`,
        username: `testuser${i}_${crypto.randomBytes(4).toString('hex')}`,
        phone: `+9199999999${i}${Math.floor(Math.random() * 10)}`,
        email: `test${i}_${crypto.randomBytes(2).toString('hex')}@test.com`,
      },
    });
    users.push(user);
    console.log(`Created user: ${user.username}`);
  }

  // 2. Create a Sponsored Challenge
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7); // Active for 7 days

  const challenge = await prisma.challenge.create({
    data: {
      title: 'Awesome Dance Challenge',
      description: 'Show us your best dance moves and win big!',
      hashtagName: '#DanceWithPopli',
      bannerUrl: 'https://images.unsplash.com/photo-1547153760-18fc86324498?q=80&w=600&auto=format&fit=crop',
      rewardPool: 5000,
      startDate: new Date(),
      endDate: endDate,
      status: 'ACTIVE',
      participantCount: 5,
      isSponsored: true,
      sponsorName: 'Popli Entertainment',
      sponsorLogoUrl: 'https://ui-avatars.com/api/?name=Popli+Ent&background=random',
    },
  });
  console.log(`Created challenge: ${challenge.title} (ID: ${challenge.id})`);

  // 3. Add users as participants and create a reel for each
  for (let i = 0; i < users.length; i++) {
    const user = users[i];

    // Create participant record
    await prisma.challengeParticipant.create({
      data: {
        challengeId: challenge.id,
        userId: user.id,
        score: 0, // Will be incremented by engagement
      },
    });

    // Create a reel for the user linked to the challenge
    const reel = await prisma.reel.create({
      data: {
        creatorId: user.id,
        mediaUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1547153760-18fc86324498?q=80&w=400&auto=format&fit=crop',
        challengeId: challenge.id,
        challengeApprovalStatus: 'APPROVED',
        viewsCount: 0,
        likesCount: 0,
      },
    });

    console.log(`User ${user.username} joined and submitted reel ID: ${reel.id}`);

    // 4. Simulate engagement to update score
    // Add random views (1 point each)
    const views = Math.floor(Math.random() * 50) + 10;
    for (let v = 0; v < views; v++) {
      await prisma.challengeParticipant.update({
        where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } },
        data: { score: { increment: 1 } },
      });
      await prisma.reel.update({
        where: { id: reel.id },
        data: { viewsCount: { increment: 1 } },
      });
    }

    // Add random likes (5 points each)
    const likes = Math.floor(Math.random() * 20) + 5;
    for (let l = 0; l < likes; l++) {
      await prisma.challengeParticipant.update({
        where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } },
        data: { score: { increment: 5 } },
      });
      await prisma.reel.update({
        where: { id: reel.id },
        data: { likesCount: { increment: 1 } },
      });
    }
  }

  console.log('\n--- Seeding Complete! ---');
  console.log(`\nTest this Challenge ID in the App: ${challenge.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
