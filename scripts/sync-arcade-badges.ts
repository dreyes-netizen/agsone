import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { ARCADE_BADGES } from "../lib/minigames/solo/badges";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const badge of ARCADE_BADGES) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: {
        description: badge.description,
        criteriaType: "AUTO_RULE",
        criteriaConfig: { domain: "solo_arcade" },
      },
      create: {
        name: badge.name,
        description: badge.description,
        criteriaType: "AUTO_RULE",
        criteriaConfig: { domain: "solo_arcade" },
      },
    });
    console.log(`Synced arcade badge: ${badge.name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
