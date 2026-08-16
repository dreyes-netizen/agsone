-- Web Push device subscriptions.
--
-- One row per DEVICE, not per user: an employee with a phone and a laptop
-- has two. `endpoint` is the per-device URL the browser's push service issues
-- (FCM for Chrome/Android, Mozilla autopush, Apple for Safari) and is the
-- natural unique key — re-subscribing the same device returns the same
-- endpoint, so the upsert on it is idempotent.
--
-- p256dh and auth are the client's encryption keys. They are required to
-- encrypt the payload and are useless without the device, so they are not
-- credentials in the usual sense, but they are still per-user data and the row
-- cascades away with the user.
--
-- Purely additive: no existing table is touched.

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
