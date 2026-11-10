import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ensureSqlitePragmas, prisma } from "@/lib/db";
import { jsonLdScript, organizationJsonLd, productJsonLd } from "@/lib/seo";

it("uses WAL, a busy timeout, and the hot indexes", async () => {
  await ensureSqlitePragmas();
  const mode = await prisma.$queryRawUnsafe<Array<{ journal_mode: string }>>("PRAGMA journal_mode");
  expect(mode[0]?.journal_mode).toBe("wal");
  const busy = await prisma.$queryRawUnsafe<Array<{ timeout: number | bigint }>>("PRAGMA busy_timeout");
  expect(Number(busy[0]?.timeout)).toBe(5000);

  const indexes = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'index'",
  );
  const names = new Set(indexes.map((row) => row.name));
  expect(names.has("Order_userId_createdAt_idx")).toBe(true);
  expect(names.has("Order_userId_status_createdAt_idx")).toBe(true);
  expect(names.has("Order_status_createdAt_idx")).toBe(true);
  expect(names.has("Coupon_code_key")).toBe(true);
  expect(names.has("AuditLog_createdAt_idx")).toBe(true);
});

it("runs the expire script under tsx", () => {
  const source = readFileSync("scripts/expire-orders.ts", "utf8");
  expect(source).not.toMatch(/^await /m);
  const output = execFileSync("npx", ["tsx", "scripts/expire-orders.ts"], {
    encoding: "utf8",
    env: process.env,
  });
  expect(output).toContain('"ok":true');
});

it("builds product and organization JSON-LD", () => {
  const product = productJsonLd({
    name: "方案 <A>",
    description: "说明",
    sku: "sku-1",
    priceCents: 9900,
    url: "https://aisubscr.com/products/sku-1",
    image: "/uploads/products/a.webp",
    inStock: true,
    brand: "aisubscr",
  });
  expect(product).toMatchObject({
    "@type": "Product",
    offers: { priceCurrency: "CNY", price: "99.00", availability: "https://schema.org/InStock" },
  });
  expect(jsonLdScript(product)).toContain("\\u003c");
  expect(jsonLdScript(product)).not.toContain("<");

  const org = organizationJsonLd({
    name: "aisubscr",
    url: "https://aisubscr.com",
    email: "support@example.com",
    logo: "https://aisubscr.com/og.png",
  });
  expect(org).toMatchObject({ "@type": "Organization", name: "aisubscr", url: "https://aisubscr.com" });
});
