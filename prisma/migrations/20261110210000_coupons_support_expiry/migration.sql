-- Coupons, FAQ, contact/announcement settings, and unpaid-order expiry.
-- Additive only. Production applies this with `prisma migrate deploy` and does not seed.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "subtotalCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "couponCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "couponId" TEXT;
ALTER TABLE "Order" ADD COLUMN "expiresAt" DATETIME;

-- Existing orders keep their payable total as the subtotal. New orders set both explicitly.
UPDATE "Order" SET "subtotalCents" = "totalCents" WHERE "subtotalCents" = 0;

-- CreateIndex
CREATE INDEX "Order_status_expiresAt_idx" ON "Order"("status", "expiresAt");

-- AlterTable
ALTER TABLE "SiteSetting" ADD COLUMN "wechatId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteSetting" ADD COLUMN "qq" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteSetting" ADD COLUMN "contactEmail" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteSetting" ADD COLUMN "qrImageMime" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "qrImageData" TEXT;
ALTER TABLE "SiteSetting" ADD COLUMN "announcementText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteSetting" ADD COLUMN "announcementEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SiteSetting" ADD COLUMN "orderExpireMinutes" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "percentOff" INTEGER,
    "amountCents" INTEGER,
    "minOrderCents" INTEGER NOT NULL DEFAULT 0,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "maxUses" INTEGER,
    "maxUsesPerUser" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateTable
CREATE TABLE "CouponUserUsage" (
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("couponId", "userId"),
    CONSTRAINT "CouponUserUsage_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CouponUserUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "couponId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_orderId_key" ON "CouponRedemption"("orderId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_userId_idx" ON "CouponRedemption"("couponId", "userId");

-- CreateTable
CREATE TABLE "FaqEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
