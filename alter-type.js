const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Creating ENUM type...');
  try {
    await prisma.$executeRawUnsafe(`CREATE TYPE "NotificationType" AS ENUM ('follow', 'like', 'tag', 'comment', 'reply', 'comment_like');`);
  } catch (e) {
    console.log('ENUM might already exist:', e.message);
  }

  console.log('Altering Notification.type column...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType" USING "type"::"NotificationType";`);
  
  console.log('Done');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
