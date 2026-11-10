-- Login failures and registration attempts. Additive only.
-- CreateTable
CREATE TABLE "AuthRateEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AuthRateEvent_action_bucket_createdAt_idx" ON "AuthRateEvent"("action", "bucket", "createdAt");
