-- Idempotency log for payment notifications. Additive only.
-- CreateTable
CREATE TABLE "PaymentNotice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentNotice_provider_providerEventId_key" ON "PaymentNotice"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "PaymentNotice_orderNo_idx" ON "PaymentNotice"("orderNo");
