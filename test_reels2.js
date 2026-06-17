const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); async function run() { 
  const reel1 = await prisma.reel.findUnique({ where: { id: "25a9a9bd-8035-4b00-97aa-19be1ecc43dd" }, select: { id: true, mediaUrl: true } }); 
  const reel2 = await prisma.reel.findUnique({ where: { id: "8351bcf0-4627-438f-9edc-ce4710f39805" }, select: { id: true, mediaUrl: true } }); 
  console.log(JSON.stringify({ reel1, reel2 }, null, 2)); prisma.$disconnect(); 
} run();
