const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  console.log('Users:', await prisma.user.count());
  console.log('All Users:', await prisma.user.findMany({ select: { id: true, email: true, username: true } }));
  console.log('Reels:', await prisma.reel.count());
  console.log('All Reels:', await prisma.reel.findMany({ select: { id: true, creatorId: true, description: true } }));
}
main().catch(console.error).finally(() => prisma.$disconnect());
