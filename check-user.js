const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { phone: '+917974994741' }
  });
  console.log(user);
}
main().finally(() => prisma.$disconnect());
