const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.gift.findMany().then(g => {
  console.log(JSON.stringify(g, null, 2));
  p.$disconnect();
});
