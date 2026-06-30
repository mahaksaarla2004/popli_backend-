const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const interests = [
  'Technology', 'Sports', 'Music', 'Art', 'Gaming', 
  'Fashion', 'Food', 'Comedy', 'Emotional', 'Dance', 
  'Village Life', 'Motivation', 'Fitness'
];

async function seed() {
  console.log('Seeding interests...');
  for (const name of interests) {
    await prisma.interest.upsert({
      where: { name },
      update: {},
      create: { name }
    });
    console.log(`Upserted: ${name}`);
  }
  console.log('Done seeding interests.');
}

seed()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
