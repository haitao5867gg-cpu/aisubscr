import { randomInt } from "crypto";
import type { Prisma } from "@prisma/client";
import { zh } from "@/i18n/zh";
import { findUserByEmail, hashPassword, verifyPassword } from "./auth";
import { prisma } from "./db";
import { MailConfigError, sendPasswordResetEmail } from "./mail";

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MIN_INTERVAL_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 5;

export const resetMessages = {
  sent: zh.auth.codeSent,
  rateLimited: zh.auth.rateLimited,
  invalidCode: zh.auth.invalidCode,
  resetDone: zh.auth.resetDone,
  passwordRequired: zh.auth.passwordRequired,
  emailInvalid: zh.auth.emailInvalid,
} as const;

type Db = Prisma.TransactionClient;

let dummyHash: Promise<string> | null = null;

function dummyCompare(code: string) {
  dummyHash ??= hashPassword("000000");
  return dummyHash.then((hash) => verifyPassword(code, hash));
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function bucketLimited(db: Db, bucket: string, now: number) {
  const recent = await db.passwordResetSend.count({
    where: { bucket, createdAt: { gt: new Date(now - MIN_INTERVAL_MS) } },
  });
  if (recent >= 1) return true;
  const hour = await db.passwordResetSend.count({
    where: { bucket, createdAt: { gt: new Date(now - HOUR_MS) } },
  });
  return hour >= MAX_PER_HOUR;
}

export async function requestPasswordReset(input: { email: string; ip: string }): Promise<"sent" | "rate_limited"> {
  const email = normalizeEmail(input.email);
  const ip = input.ip.trim().slice(0, 64) || "unknown";
  const now = Date.now();
  const emailBucket = `email:${email}`;
  const ipBucket = `ip:${ip}`;

  const limited = await prisma.$transaction(async (tx) => {
    await tx.passwordResetSend.deleteMany({
      where: { createdAt: { lt: new Date(now - HOUR_MS) } },
    });
    if ((await bucketLimited(tx, emailBucket, now)) || (await bucketLimited(tx, ipBucket, now))) {
      return true;
    }
    await tx.passwordResetSend.createMany({
      data: [{ bucket: emailBucket }, { bucket: ipBucket }],
    });
    return false;
  });
  if (limited) return "rate_limited";

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeHash = await hashPassword(code);
  const user = await findUserByEmail(email);
  if (!user) return "sent";

  const expiresAt = new Date(now + CODE_TTL_MS);
  await prisma.passwordResetCode.upsert({
    where: { userId: user.id },
    create: { userId: user.id, codeHash, expiresAt, attempts: 0 },
    update: { codeHash, expiresAt, attempts: 0, createdAt: new Date(now) },
  });

  try {
    await sendPasswordResetEmail(user.email, code);
  } catch (error) {
    await prisma.passwordResetCode.deleteMany({ where: { userId: user.id } });
    const reason = error instanceof Error ? error.message : "send failed";
    if (error instanceof MailConfigError) {
      console.error(`[aisubscr mail] password reset is not configured (${reason}). Console fallback was not used.`);
    } else {
      console.error(
        `[aisubscr mail] password reset send failed to=${user.email} (${reason}). Console fallback was not used.`,
      );
    }
  }
  return "sent";
}

export async function resetPassword(input: {
  email: string;
  code: string;
  password: string;
}): Promise<{ ok: true; userId: string } | { ok: false }> {
  const user = await findUserByEmail(normalizeEmail(input.email));
  if (!user) {
    await dummyCompare(input.code);
    return { ok: false };
  }

  let compared = false;
  const outcome = await prisma.$transaction(async (tx) => {
    const row = await tx.passwordResetCode.findUnique({ where: { userId: user.id } });
    if (!row || row.expiresAt.getTime() <= Date.now() || row.attempts >= MAX_ATTEMPTS) {
      if (row) await tx.passwordResetCode.delete({ where: { id: row.id } });
      return "invalid" as const;
    }

    const updated = await tx.passwordResetCode.updateMany({
      where: { id: row.id, attempts: { lt: MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (updated.count !== 1) {
      await tx.passwordResetCode.deleteMany({ where: { id: row.id } });
      return "invalid" as const;
    }

    compared = true;
    const match = await verifyPassword(input.code, row.codeHash);
    if (!match) {
      const after = await tx.passwordResetCode.findUnique({ where: { id: row.id } });
      if (after && after.attempts >= MAX_ATTEMPTS) {
        await tx.passwordResetCode.delete({ where: { id: row.id } });
      }
      return "invalid" as const;
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(input.password),
        sessionVersion: { increment: 1 },
      },
    });
    await tx.passwordResetCode.delete({ where: { id: row.id } });
    return "ok" as const;
  }, { timeout: 15000 });

  if (!compared) await dummyCompare(input.code);
  if (outcome !== "ok") return { ok: false };
  return { ok: true, userId: user.id };
}
