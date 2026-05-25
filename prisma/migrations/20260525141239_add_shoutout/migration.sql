-- AlterEnum
ALTER TYPE "PostType" ADD VALUE 'SHOUTOUT';

-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN     "recipientId" TEXT;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
