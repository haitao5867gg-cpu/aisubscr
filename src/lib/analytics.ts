import { createHmac } from "node:crypto";
import { prisma } from "./db";
import { clientIp } from "./client-ip";

export const ANALYTICS_RETENTION_DAYS = 90;
const HOUR_MS = 60 * 60 * 1000;
const MAX_VIEWS_PER_HOUR = 60;
const DEDUPE_MS = 30 * 60 * 1000;

export type DeviceKind = "mobile" | "tablet" | "desktop";

/**
 * Salt for the daily visitor HMAC. ANALYTICS_SALT wins so a host can rotate
 * the visitor id without changing the session secret. The raw IP is an input
 * only and is never written to PageView or AnalyticsEvent.
 */
export function analyticsSalt() {
  return process.env.ANALYTICS_SALT?.trim() || process.env.SESSION_SECRET?.trim() || "aisubscr-analytics";
}

/** UTC day, so the visitor id rotates even if the process stays up. */
export function analyticsDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function dailyVisitorHash(ip: string, userAgent: string, now = new Date(), salt = analyticsSalt()) {
  const day = analyticsDay(now);
  return createHmac("sha256", salt).update(`${day}|${ip}|${userAgent.slice(0, 300)}`).digest("hex").slice(0, 32);
}

export function coarseDevice(userAgent: string): DeviceKind {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone|opera mini/.test(ua)) return "mobile";
  return "desktop";
}

function hostName(value: string) {
  return value.trim().toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
}

/** Hostname only. Same-site and non-http referrers become an empty string. */
export function referrerDomain(referrer: string, selfHost = "") {
  if (!referrer || referrer.length > 500) return "";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "";
  const host = hostName(url.hostname);
  if (!host) return "";
  const self = hostName(selfHost);
  if (self && host === self) return "";
  return host.slice(0, 120);
}

/**
 * Shop path only. Query strings are dropped so tokens in the query are not stored.
 * Public order tokens in the path collapse to /order.
 */
export function analyticsPath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\") || trimmed.includes("..")) {
    return null;
  }
  const bare = (trimmed.split("#")[0] ?? "").split("?")[0] ?? "";
  const path = bare.replace(/\/+$/, "") || "/";
  if (path.length > 180) return null;
  if (skipAnalytics(path)) return null;
  return collapsePublicOrder(path);
}

/** Admin, API, and framework paths are not shop page views. */
function skipAnalytics(value: string) {
  if (value.startsWith("/admin")) return true;
  if (value.startsWith("/api")) return true;
  if (value.startsWith("/_next")) return true;
  return false;
}

/** The public order token is a secret. Keep the page, drop the token. */
function collapsePublicOrder(value: string) {
  if (!value.startsWith("/order/")) return value;
  return "/order";
}

export function isProductPath(path: string) {
  return /^\/products\/[^/]+$/.test(path);
}

type RecordInput = {
  path: string;
  referrer: string;
  userAgent: string;
  ip: string;
  selfHost?: string;
  now?: Date;
};

/**
 * Insert one page view. A visitor+path pair is kept once per 30 minutes, and
 * a visitor is capped per hour, so a loop cannot fill the table.
 * The returned row never includes the IP or user agent.
 */
export async function recordPageView(input: RecordInput) {
  const path = analyticsPath(input.path);
  if (!path) return null;
  const now = input.now ?? new Date();
  const visitorHash = dailyVisitorHash(input.ip, input.userAgent, now);
  const sinceHour = new Date(now.getTime() - HOUR_MS);
  const recent = await prisma.pageView.count({
    where: { visitorHash, createdAt: { gt: sinceHour } },
  });
  if (recent >= MAX_VIEWS_PER_HOUR) return null;
  const duplicate = await prisma.pageView.findFirst({
    where: { visitorHash, path, createdAt: { gt: new Date(now.getTime() - DEDUPE_MS) } },
    select: { id: true },
  });
  if (duplicate) return null;
  return prisma.pageView.create({
    data: {
      path,
      referrer: referrerDomain(input.referrer, input.selfHost ?? ""),
      device: coarseDevice(input.userAgent),
      visitorHash,
      createdAt: now,
    },
  });
}

export async function recordCheckout(headers: Headers, orderId: string, now = new Date()) {
  try {
    const visitorHash = dailyVisitorHash(clientIp(headers), headers.get("user-agent") ?? "", now);
    await prisma.analyticsEvent.create({
      data: { kind: "checkout", visitorHash, orderId, createdAt: now },
    });
  } catch (error) {
    console.error("[aisubscr analytics] checkout", error);
  }
}

/** Copy the checkout visitor hash so a payment webhook does not need the buyer's IP. */
export async function recordPaid(orderId: string, now = new Date()) {
  try {
    const prior = await prisma.analyticsEvent.findFirst({
      where: { orderId, kind: "checkout" },
      orderBy: { createdAt: "desc" },
      select: { visitorHash: true },
    });
    const visitorHash =
      prior?.visitorHash ??
      createHmac("sha256", analyticsSalt()).update(`paid|${orderId}`).digest("hex").slice(0, 32);
    await prisma.analyticsEvent.create({
      data: { kind: "paid", visitorHash, orderId, createdAt: now },
    });
  } catch (error) {
    console.error("[aisubscr analytics] paid", error);
  }
}

export async function purgeAnalytics(now = new Date()) {
  const cutoff = new Date(now.getTime() - ANALYTICS_RETENTION_DAYS * 24 * HOUR_MS);
  const [views, events] = await prisma.$transaction([
    prisma.pageView.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }),
  ]);
  return { pageViews: views.count, events: events.count };
}

export type AnalyticsSummary = {
  days: 7 | 30;
  visitors: number;
  pageViews: number;
  topPages: { path: string; views: number }[];
  topReferrers: { domain: string; views: number }[];
  devices: Record<DeviceKind, number>;
  funnel: { product: number; cart: number; checkout: number; paid: number };
  daysSeries: { day: string; views: number; visitors: number }[];
};

function distinctCount(rows: { visitorHash: string }[]) {
  return new Set(rows.map((row) => row.visitorHash)).size;
}

export async function analyticsSummary(days: 7 | 30, now = new Date()): Promise<AnalyticsSummary> {
  const since = new Date(now.getTime() - days * 24 * HOUR_MS);
  const [views, checkouts, paid] = await Promise.all([
    prisma.pageView.findMany({
      where: { createdAt: { gte: since } },
      select: { path: true, referrer: true, device: true, visitorHash: true, createdAt: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { kind: "checkout", createdAt: { gte: since } },
      select: { visitorHash: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { kind: "paid", createdAt: { gte: since } },
      select: { visitorHash: true },
    }),
  ]);

  const pageCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  const devices: Record<DeviceKind, number> = { mobile: 0, tablet: 0, desktop: 0 };
  const byDay = new Map<string, { views: number; hashes: Set<string> }>();
  const product = new Set<string>();
  const cart = new Set<string>();

  for (const view of views) {
    pageCounts.set(view.path, (pageCounts.get(view.path) ?? 0) + 1);
    if (view.referrer) referrerCounts.set(view.referrer, (referrerCounts.get(view.referrer) ?? 0) + 1);
    if (view.device === "mobile" || view.device === "tablet" || view.device === "desktop") {
      devices[view.device] += 1;
    }
    const day = view.createdAt.toISOString().slice(0, 10);
    const bucket = byDay.get(day) ?? { views: 0, hashes: new Set<string>() };
    bucket.views += 1;
    bucket.hashes.add(view.visitorHash);
    byDay.set(day, bucket);
    if (isProductPath(view.path)) product.add(view.visitorHash);
    if (view.path === "/cart") cart.add(view.visitorHash);
  }

  const topPages = [...pageCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([path, count]) => ({ path, views: count }));
  const topReferrers = [...referrerCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([domain, count]) => ({ domain, views: count }));
  const daysSeries = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, bucket]) => ({ day, views: bucket.views, visitors: bucket.hashes.size }));

  return {
    days,
    visitors: distinctCount(views),
    pageViews: views.length,
    topPages,
    topReferrers,
    devices,
    funnel: {
      product: product.size,
      cart: cart.size,
      checkout: distinctCount(checkouts),
      paid: distinctCount(paid),
    },
    daysSeries,
  };
}
