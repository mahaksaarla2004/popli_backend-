const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.reel.findMany({ orderBy: { createdAt: 'desc' }, take: 1, include: { location: true } })
  .then(d => console.dir(d, {depth: null}))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
