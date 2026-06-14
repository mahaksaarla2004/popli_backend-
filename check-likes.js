const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findFirst({ where: { username: 'rahul_dance_off' }});
  if (!user) return console.log('User not found');
  
  console.log(`User: ${user.id} ${user.username}`);
  const likes = await prisma.like.findMany({ where: { userId: user.id }, include: { reel: true } });
  console.log(`Likes count: ${likes.length}`);
  
  if (likes.length > 0) {
    console.log(likes[0].reel);
  }
}
check().catch(console.error).finally(() => prisma.$disconnect());
