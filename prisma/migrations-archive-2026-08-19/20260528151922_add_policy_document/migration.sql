-- CreateTable
CREATE TABLE "PolicyDocument" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PolicyDocument" ADD CONSTRAINT "PolicyDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
