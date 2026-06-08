import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultInterests = [
  { name: 'Technology', icon: '💻' },
  { name: 'Sports', icon: '⚽' },
  { name: 'Music', icon: '🎵' },
  { name: 'Art', icon: '🎨' },
  { name: 'Gaming', icon: '🎮' },
  { name: 'Fashion', icon: '👗' },
  { name: 'Food', icon: '🍔' },
  { name: 'Travel', icon: '✈️' },
  { name: 'Photography', icon: '📷' },
  { name: 'Movies', icon: '🎬' },
];

async function main() {
  console.log('Seeding default interests...');
  for (const interest of defaultInterests) {
    await prisma.interest.upsert({
      where: { name: interest.name },
      update: {},
      create: interest,
    });
  }
  console.log('Interests seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
