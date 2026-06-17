const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Adding mention to ENUM type...');
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "NotificationType" ADD VALUE 'mention';`);
  } catch (e) {
    console.log('Error or already exists:', e.message);
  }
  
  console.log('Done');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
