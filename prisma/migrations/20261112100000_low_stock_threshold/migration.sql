-- Per-product low-stock threshold and the admin email toggle.
-- Additive only: existing rows keep a threshold of 5, and unlimited stock (NULL) still does not warn.

ALTER TABLE "Product" ADD COLUMN "lowStockThreshold" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "SiteSetting" ADD COLUMN "notifyLowStock" BOOLEAN NOT NULL DEFAULT true;
