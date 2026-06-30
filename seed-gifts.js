const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const gifts = [
  { id: 'rocket', name: 'Rocket', costInCoins: 500, iconUrl: 'rocket', animationType: 'fly' },
  { id: 'rose', name: 'Rose', costInCoins: 10, iconUrl: 'rose', animationType: 'burst' },
  { id: 'heart', name: 'Heart', costInCoins: 50, iconUrl: 'heart', animationType: 'float' },
  { id: 'crown', name: 'Crown', costInCoins: 2000, iconUrl: 'crown', animationType: 'spin' },
  { id: 'diamond', name: 'Diamond', costInCoins: 5000, iconUrl: 'diamond', animationType: 'burst' },
  { id: 'party', name: 'Party', costInCoins: 150, iconUrl: 'party', animationType: 'burst' },
  { id: 'sparkle', name: 'Sparkle', costInCoins: 300, iconUrl: 'sparkle', animationType: 'float' },
  { id: 'star', name: 'Star', costInCoins: 5, iconUrl: 'star', animationType: 'fly' }
];

async function seedGifts() {
  console.log('Seeding gifts...');
  for (const gift of gifts) {
    await prisma.gift.upsert({
      where: { id: gift.id },
      update: {
        name: gift.name,
        costInCoins: gift.costInCoins,
        iconUrl: gift.iconUrl,
        animationType: gift.animationType
      },
      create: {
        id: gift.id,
        name: gift.name,
        costInCoins: gift.costInCoins,
        iconUrl: gift.iconUrl,
        animationType: gift.animationType
      }
    });
    console.log(`Upserted gift: ${gift.name}`);
  }
  console.log('Done seeding gifts.');
}

seedGifts()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
