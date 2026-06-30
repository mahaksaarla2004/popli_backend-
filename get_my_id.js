const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { phone: '+919876543210' }
  });
  console.log(user);
}

main().finally(() => prisma.$disconnect());