const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.interest.findMany({
  where: { isActive: true },
  select: { id: true, name: true }
}).then(r => {
  console.log(JSON.stringify(r, null, 2));
  p.$disconnect();
});
