const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const gifts = await prisma.gift.findMany({
    orderBy: { costInCoins: 'asc' },
  });

  console.log('\n--- GIFT TABLE ---\n');
  gifts.forEach((g) => {
    console.log(
      `${g.name.padEnd(15)} | coins: ${String(g.costInCoins).padEnd(8)} | costInINR: ${g.costInINR}`
    );
  });
  console.log(`\nTotal gifts: ${gifts.length}\n`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
