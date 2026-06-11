// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("../lib/generated/prisma/client");

const prisma = new PrismaClient();

async function main() {
  const posts = await prisma.socialPost.findMany({
    where: { type: "SHOUTOUT", recipientId: { not: null } },
    select: { id: true, recipientId: true },
  });

  console.log(`Migrating ${posts.length} shoutout(s)…`);

  for (const post of posts) {
    if (!post.recipientId) continue;
    await prisma.shoutoutRecipient.upsert({
      where: { postId_userId: { postId: post.id, userId: post.recipientId } },
      create: { postId: post.id, userId: post.recipientId },
      update: {},
    });
    console.log(`  ✓ post ${post.id} → user ${post.recipientId}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
