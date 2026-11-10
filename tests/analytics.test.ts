import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { POST as collect } from "@/app/api/analytics/collect/route";
import {
  analyticsPath,
  analyticsSummary,
  coarseDevice,
  dailyVisitorHash,
  purgeAnalytics,
  recordCheckout,
  recordPageView,
  recordPaid,
  referrerDomain,
} from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { jsonRequest, nextIp } from "./http";

const IP = "203.0.113.44";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) UA-TOKEN-XYZ";

it("rotates a visitor hash daily and never puts the raw IP in the hash", () => {
  const day = new Date("2026-11-10T12:00:00Z");
  const next = new Date("2026-11-11T00:00:00Z");
  const hash = dailyVisitorHash(IP, UA, day, "salt");
  expect(hash).toMatch(/^[0-9a-f]{32}$/);
  expect(hash).toBe(dailyVisitorHash(IP, UA, day, "salt"));
  expect(hash).not.toBe(dailyVisitorHash(IP, UA, next, "salt"));
  expect(hash).not.toBe(dailyVisitorHash("203.0.113.45", UA, day, "salt"));
  expect(hash).not.toContain(IP);
  expect(hash).not.toContain(".");
  expect(coarseDevice(UA)).toBe("mobile");
  expect(coarseDevice("Mozilla/5.0 (iPad) Tablet")).toBe("tablet");
  expect(coarseDevice("Mozilla/5.0 (Windows NT 10.0)")).toBe("desktop");
  expect(referrerDomain("https://www.news.example/story?id=1", "aisubscr.com")).toBe("news.example");
  expect(referrerDomain("https://aisubscr.com/products", "aisubscr.com")).toBe("");
  expect(analyticsPath("/order/secret-token?x=1")).toBe("/order");
  expect(analyticsPath("/admin/tickets")).toBeNull();
  expect(analyticsPath("/products/abc")).toBe("/products/abc");
});

it("stores a page view without the IP or user agent", async () => {
  const row = await recordPageView({
    path: "/products/sample?utm=1",
    referrer: "https://news.example/a?q=secret",
    userAgent: UA,
    ip: IP,
    selfHost: "127.0.0.1:3000",
    now: new Date(),
  });
  expect(row?.path).toBe("/products/sample");
  expect(row?.referrer).toBe("news.example");
  expect(row?.device).toBe("mobile");
  const stored = JSON.stringify(row);
  expect(stored).not.toContain(IP);
  expect(stored).not.toContain("UA-TOKEN-XYZ");
  expect(await recordPageView({
    path: "/products/sample",
    referrer: "",
    userAgent: UA,
    ip: IP,
    now: new Date(),
  })).toBeNull();

  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>("PRAGMA table_info(PageView)");
  expect(columns.map((column) => column.name).sort()).toEqual(["createdAt", "device", "id", "path", "referrer", "visitorHash"]);
  const eventColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>("PRAGMA table_info(AnalyticsEvent)");
  expect(eventColumns.map((column) => column.name).join(" ")).not.toMatch(/ip/i);
});

it("counts the funnel and drops rows older than 90 days", async () => {
  await prisma.pageView.deleteMany();
  await prisma.analyticsEvent.deleteMany();
  const now = new Date();
  const hashA = "a".repeat(32);
  const hashB = "b".repeat(32);
  await prisma.pageView.createMany({
    data: [
      { path: "/products/plan", referrer: "news.example", device: "desktop", visitorHash: hashA, createdAt: now },
      { path: "/cart", referrer: "", device: "desktop", visitorHash: hashA, createdAt: now },
      { path: "/cart", referrer: "partner.test", device: "mobile", visitorHash: hashB, createdAt: now },
    ],
  });
  await prisma.analyticsEvent.create({ data: { kind: "checkout", visitorHash: hashA, orderId: "order-a", createdAt: now } });
  await recordPaid("order-a", now);
  const summary = await analyticsSummary(7, now);
  expect(summary.funnel).toEqual({ product: 1, cart: 2, checkout: 1, paid: 1 });
  expect(summary.topReferrers.map((row) => row.domain)).toEqual(["news.example", "partner.test"]);
  expect(summary.visitors).toBeGreaterThanOrEqual(2);

  const stale = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000);
  const kept = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  await prisma.pageView.create({ data: { path: "/stale-page", device: "desktop", visitorHash: "c".repeat(32), createdAt: stale } });
  await prisma.analyticsEvent.create({ data: { kind: "checkout", visitorHash: "d".repeat(32), orderId: "old-order", createdAt: stale } });
  await prisma.pageView.create({ data: { path: "/kept-page", device: "desktop", visitorHash: "e".repeat(32), createdAt: kept } });
  const purged = await purgeAnalytics(now);
  expect(purged.pageViews).toBeGreaterThanOrEqual(1);
  expect(purged.events).toBeGreaterThanOrEqual(1);
  expect(await prisma.pageView.findFirst({ where: { path: "/stale-page" } })).toBeNull();
  expect(await prisma.pageView.findFirst({ where: { path: "/kept-page" } })).toBeTruthy();
  expect(await prisma.analyticsEvent.findFirst({ where: { orderId: "old-order" } })).toBeNull();
});

it("collects a beacon without returning the visitor address", async () => {
  const ip = nextIp();
  const res = await collect(jsonRequest("/api/analytics/collect", {
    ip,
    headers: { "user-agent": UA },
    body: { path: "/help", referrer: "https://example.com/docs" },
  }));
  expect(res.status).toBe(200);
  const body = JSON.stringify(await res.json());
  expect(body).not.toContain(ip);
  expect(body).toBe('{"ok":true}');
  const row = await prisma.pageView.findFirst({ where: { path: "/help", referrer: "example.com" } });
  expect(row).toBeTruthy();
  expect(JSON.stringify(row)).not.toContain(ip);
  expect((await collect(jsonRequest("/api/analytics/collect", { ip, body: { path: "/admin/orders" } }))).status).toBe(400);

  const headers = new Headers({ "x-real-ip": ip, "user-agent": "desktop" });
  await recordCheckout(headers, "wired-order");
  await recordPaid("wired-order");
  expect(await prisma.analyticsEvent.count({ where: { orderId: "wired-order" } })).toBe(2);

  const source = [
    readFileSync("src/middleware.ts", "utf8"),
    readFileSync("src/app/layout.tsx", "utf8"),
    readFileSync("src/app/api/orders/route.ts", "utf8"),
    readFileSync("src/lib/payments/confirm.ts", "utf8"),
    readFileSync("scripts/expire-orders.ts", "utf8"),
  ].join("\n");
  expect(source).toContain("connect-src 'self'");
  expect(source).toContain("recordCheckout");
  expect(source).toContain("recordPaid");
  expect(source).toContain("purgeAnalytics");
  expect(source).not.toMatch(/google-analytics|googletagmanager|plausible/i);
});
