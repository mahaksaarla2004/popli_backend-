const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.user.updateMany({
  where: {
    isProfileComplete: false,
    name: { not: 'Popli User' },
    username: { not: { startsWith: 'user_' } }
  },
  data: { isProfileComplete: true }
}).then(r => {
  console.log(r);
  p.$disconnect();
});
