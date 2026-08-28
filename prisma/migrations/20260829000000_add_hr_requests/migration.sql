-- CreateEnum
CREATE TYPE "HrRequestStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "HrRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientRef" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "catalogVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "HrRequestStatus" NOT NULL DEFAULT 'NEW',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HrRequest_clientRef_key" ON "HrRequest"("clientRef");

-- CreateIndex
CREATE INDEX "HrRequest_status_createdAt_idx" ON "HrRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "HrRequest_userId_createdAt_idx" ON "HrRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "HrRequest_typeId_createdAt_idx" ON "HrRequest"("typeId", "createdAt");

-- AddForeignKey
ALTER TABLE "HrRequest" ADD CONSTRAINT "HrRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRequest" ADD CONSTRAINT "HrRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
