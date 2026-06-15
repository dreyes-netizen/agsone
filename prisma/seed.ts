import "dotenv/config";
import { PrismaClient, RewardCategory } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const rewards = [
  {
    name: "Coffee Voucher",
    description: "Redeem for a free coffee at the office pantry or a partner café.",
    pointCost: 50,
    category: RewardCategory.VOUCHER,
    stockQuantity: -1,
  },
  {
    name: "Meal Voucher",
    description: "Enjoy a complimentary meal covered by the company.",
    pointCost: 100,
    category: RewardCategory.VOUCHER,
    stockQuantity: -1,
  },
  {
    name: "Company Merchandise",
    description: "Claim official AGS branded merchandise — apparel, accessories, and more.",
    pointCost: 200,
    category: RewardCategory.PHYSICAL,
    stockQuantity: -1,
  },
  {
    name: "Half-Day Privilege",
    description: "Take a half-day off on a date of your choice, subject to team schedule and HR approval.",
    pointCost: 300,
    category: RewardCategory.PRIVILEGE,
    stockQuantity: -1,
  },
  {
    name: "Paid Leave Credit",
    description: "Add one paid leave credit to your leave balance, subject to HR approval.",
    pointCost: 500,
    category: RewardCategory.PRIVILEGE,
    stockQuantity: -1,
  },
  {
    name: "Premium Reward Package",
    description: "A curated package of premium items handpicked by HR. Contents vary per batch.",
    pointCost: 750,
    category: RewardCategory.PHYSICAL,
    stockQuantity: -1,
  },
  {
    name: "Major Incentive Reward",
    description: "The top-tier reward for outstanding contributors. Details are provided upon HR approval.",
    pointCost: 1000,
    category: RewardCategory.PHYSICAL,
    stockQuantity: -1,
  },
];

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "HR_ADMIN"] } },
    orderBy: { createdAt: "asc" },
  });

  if (!admin) {
    console.error("No admin user found. Create a SUPER_ADMIN or HR_ADMIN user first.");
    process.exit(1);
  }

  console.log(`Seeding rewards as: ${admin.displayName ?? admin.email}\n`);

  for (const reward of rewards) {
    const existing = await prisma.reward.findFirst({ where: { name: reward.name } });
    if (existing) {
      console.log(`⟳  Skipped (already exists): ${reward.name}`);
      continue;
    }
    await prisma.reward.create({
      data: { ...reward, imageUrls: [], createdById: admin.id },
    });
    console.log(`✓  Created: ${reward.name} (${reward.pointCost} pts)`);
  }

  console.log("\n✅ Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
