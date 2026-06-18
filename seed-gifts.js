const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const GIFT_CATALOG = [
  { id: 'rocket', name: 'Rocket', costInCoins: 500, costInINR: 50, iconUrl: 'rocket.png' },
  { id: 'rose', name: 'Rose', costInCoins: 10, costInINR: 1, iconUrl: 'rose.png' },
  { id: 'heart', name: 'Heart', costInCoins: 50, costInINR: 5, iconUrl: 'heart.png' },
  { id: 'crown', name: 'Crown', costInCoins: 2000, costInINR: 200, iconUrl: 'crown.png' },
  { id: 'diamond', name: 'Diamond', costInCoins: 5000, costInINR: 500, iconUrl: 'diamond.png' },
  { id: 'party', name: 'Party', costInCoins: 100, costInINR: 10, iconUrl: 'party.png' },
  { id: 'sparkle', name: 'Sparkles', costInCoins: 20, costInINR: 2, iconUrl: 'sparkle.png' },
  { id: 'star', name: 'Star', costInCoins: 200, costInINR: 20, iconUrl: 'star.png' }
];

async function main() {
  console.log('Seeding gifts...');
  for (const gift of GIFT_CATALOG) {
    await prisma.gift.upsert({
      where: { id: gift.id },
      update: gift,
      create: gift,
    });
  }
  console.log('Done!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
