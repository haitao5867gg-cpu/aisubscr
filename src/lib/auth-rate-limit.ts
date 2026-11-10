import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { normalizeEmail } from "./email";

const HOUR_MS = 60 * 60 * 1000;

type WindowLimit = { windowMs: number; max: number };

/**
 * Login counts failures only, so a correct password is not punished and a
 * typo can be retried immediately. Registration counts every attempt and uses
 * the same windows as password-reset sends (1 per minute, 5 per hour).
 */
const LIMITS = {
  login: {
    email: [{ windowMs: 15 * 60 * 1000, max: 5 }],
    ip: [{ windowMs: 15 * 60 * 1000, max: 20 }],
  },
  register: {
    email: [
      { windowMs: 60 * 1000, max: 1 },
      { windowMs: HOUR_MS, max: 5 },
    ],
    ip: [
      { windowMs: 60 * 1000, max: 1 },
      { windowMs: HOUR_MS, max: 5 },
    ],
  },
  // Wrong authenticator or recovery codes. A correct password is not a login failure.
  totp: {
    email: [{ windowMs: 15 * 60 * 1000, max: 5 }],
    ip: [{ windowMs: 15 * 60 * 1000, max: 20 }],
  },
  // The "email" bucket is the signed-in user id. Creation and replies share
  // the one-hour cleanup already used by login and registration.
  ticketCreate: {
    email: [
      { windowMs: 10 * 60 * 1000, max: 3 },
      { windowMs: HOUR_MS, max: 10 },
    ],
    ip: [
      { windowMs: 10 * 60 * 1000, max: 6 },
      { windowMs: HOUR_MS, max: 20 },
    ],
  },
  ticketReply: {
    email: [
      { windowMs: 10 * 60 * 1000, max: 8 },
      { windowMs: HOUR_MS, max: 40 },
    ],
    ip: [
      { windowMs: 10 * 60 * 1000, max: 15 },
      { windowMs: HOUR_MS, max: 60 },
    ],
  },
  ticketUpload: {
    email: [
      { windowMs: 10 * 60 * 1000, max: 8 },
      { windowMs: HOUR_MS, max: 20 },
    ],
    ip: [
      { windowMs: 10 * 60 * 1000, max: 12 },
      { windowMs: HOUR_MS, max: 30 },
    ],
  },
} as const;

/** Anonymous beacon. One bucket per IP so a rotating user-agent cannot mint visitors. */
const IP_LIMITS = {
  analyticsCollect: [
    { windowMs: 60 * 1000, max: 30 },
    { windowMs: HOUR_MS, max: 120 },
  ],
} as const;

type IpAction = keyof typeof IP_LIMITS;

type RateAction = keyof typeof LIMITS;

export type RateLimitResult = { limited: false } | { limited: true; retryAfterSeconds: number };

type Db = Prisma.TransactionClient;

function bucket(kind: "email" | "ip", value: string) {
  return `${kind}:${value}`;
}

async function retryAfter(
  db: Db,
  action: string,
  key: string,
  limits: readonly WindowLimit[],
  now: number,
): Promise<number | null> {
  let wait: number | null = null;
  for (const limit of limits) {
    const since = new Date(now - limit.windowMs);
    const count = await db.authRateEvent.count({
      where: { action, bucket: key, createdAt: { gt: since } },
    });
    if (count < limit.max) continue;
    const oldest = await db.authRateEvent.findFirst({
      where: { action, bucket: key, createdAt: { gt: since } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    const retryMs = oldest ? oldest.createdAt.getTime() + limit.windowMs - now : limit.windowMs;
    wait = Math.max(wait ?? 0, Math.max(1, Math.ceil(retryMs / 1000)));
  }
  return wait;
}

async function inspect(action: RateAction, email: string, ip: string, record: boolean): Promise<RateLimitResult> {
  const emailKey = bucket("email", normalizeEmail(email).slice(0, 200));
  const ipKey = bucket("ip", ip.trim().slice(0, 64) || "unknown");
  const rules = LIMITS[action];
  const now = Date.now();

  return prisma.$transaction(async (tx) => {
    await tx.authRateEvent.deleteMany({
      where: { createdAt: { lt: new Date(now - HOUR_MS) } },
    });
    const emailWait = await retryAfter(tx, action, emailKey, rules.email, now);
    const ipWait = await retryAfter(tx, action, ipKey, rules.ip, now);
    if (emailWait !== null || ipWait !== null) {
      return { limited: true, retryAfterSeconds: Math.max(emailWait ?? 0, ipWait ?? 0) };
    }
    if (record) {
      await tx.authRateEvent.createMany({
        data: [
          { action, bucket: emailKey },
          { action, bucket: ipKey },
        ],
      });
    }
    return { limited: false };
  });
}

/** Count this registration attempt. Unknown and existing emails share the budget. */
export function consumeRegisterAttempt(email: string, ip: string) {
  return inspect("register", email, ip, true);
}

/** Failures only. Call before checking the password so a locked bucket skips bcrypt. */
export function peekLoginLimit(email: string, ip: string) {
  return inspect("login", email, ip, false);
}

export function recordLoginFailure(email: string, ip: string) {
  return inspect("login", email, ip, true);
}

export function peekTotpLimit(email: string, ip: string) {
  return inspect("totp", email, ip, false);
}

export function recordTotpFailure(email: string, ip: string) {
  return inspect("totp", email, ip, true);
}

export function consumeTicketCreate(userId: string, ip: string) {
  return inspect("ticketCreate", userId, ip, true);
}

export function consumeTicketReply(userId: string, ip: string) {
  return inspect("ticketReply", userId, ip, true);
}

export function consumeTicketUpload(userId: string, ip: string) {
  return inspect("ticketUpload", userId, ip, true);
}

async function inspectIp(action: IpAction, ip: string): Promise<RateLimitResult> {
  const ipKey = bucket("ip", ip.trim().slice(0, 64) || "unknown");
  const rules = IP_LIMITS[action];
  const now = Date.now();
  return prisma.$transaction(async (tx) => {
    await tx.authRateEvent.deleteMany({
      where: { createdAt: { lt: new Date(now - HOUR_MS) } },
    });
    const wait = await retryAfter(tx, action, ipKey, rules, now);
    if (wait !== null) return { limited: true, retryAfterSeconds: wait };
    await tx.authRateEvent.create({ data: { action, bucket: ipKey } });
    return { limited: false };
  });
}

export function consumeAnalyticsCollect(ip: string) {
  return inspectIp("analyticsCollect", ip);
}
