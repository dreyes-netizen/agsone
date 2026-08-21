-- CreateEnum
CREATE TYPE "SoloAttemptStatus" AS ENUM ('STARTED', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ArcadeChampionScope" AS ENUM ('COMPANY', 'DEPARTMENT');

-- CreateTable
CREATE TABLE "SoloGameAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT,
    "gameType" TEXT NOT NULL,
    "status" "SoloAttemptStatus" NOT NULL DEFAULT 'STARTED',
    "attemptNumber" INTEGER NOT NULL,
    "rankDate" DATE NOT NULL,
    "weekStart" DATE NOT NULL,
    "challenge" JSONB NOT NULL,
    "challengeVersion" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "primaryScore" INTEGER,
    "secondaryScore" INTEGER,
    "metrics" JSONB,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "validationReason" TEXT,

    CONSTRAINT "SoloGameAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArcadeWeeklyChampion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "scope" "ArcadeChampionScope" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "departmentId" TEXT,
    "departmentNameSnapshot" TEXT,
    "weekStart" DATE NOT NULL,
    "winningAttemptId" TEXT NOT NULL,
    "primaryScore" INTEGER NOT NULL,
    "secondaryScore" INTEGER,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArcadeWeeklyChampion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoloGameAttempt_gameType_status_weekStart_idx" ON "SoloGameAttempt"("gameType", "status", "weekStart");

-- CreateIndex
CREATE INDEX "SoloGameAttempt_userId_gameType_completedAt_idx" ON "SoloGameAttempt"("userId", "gameType", "completedAt");

-- CreateIndex
CREATE INDEX "SoloGameAttempt_departmentId_gameType_weekStart_idx" ON "SoloGameAttempt"("departmentId", "gameType", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "SoloGameAttempt_userId_gameType_rankDate_attemptNumber_key" ON "SoloGameAttempt"("userId", "gameType", "rankDate", "attemptNumber");

-- CreateIndex
CREATE INDEX "ArcadeWeeklyChampion_userId_weekStart_idx" ON "ArcadeWeeklyChampion"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "ArcadeWeeklyChampion_weekStart_gameType_idx" ON "ArcadeWeeklyChampion"("weekStart", "gameType");

-- CreateIndex
CREATE UNIQUE INDEX "ArcadeWeeklyChampion_gameType_scopeKey_weekStart_key" ON "ArcadeWeeklyChampion"("gameType", "scopeKey", "weekStart");

-- AddCheckConstraint
ALTER TABLE "SoloGameAttempt"
ADD CONSTRAINT "SoloGameAttempt_attemptNumber_check"
CHECK ("attemptNumber" BETWEEN 1 AND 3);

-- AddForeignKey
ALTER TABLE "SoloGameAttempt" ADD CONSTRAINT "SoloGameAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoloGameAttempt" ADD CONSTRAINT "SoloGameAttempt_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcadeWeeklyChampion" ADD CONSTRAINT "ArcadeWeeklyChampion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcadeWeeklyChampion" ADD CONSTRAINT "ArcadeWeeklyChampion_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArcadeWeeklyChampion" ADD CONSTRAINT "ArcadeWeeklyChampion_winningAttemptId_fkey" FOREIGN KEY ("winningAttemptId") REFERENCES "SoloGameAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
