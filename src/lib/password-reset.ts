import { randomInt, randomUUID } from "crypto";
import type { Dict } from "@/i18n";
import { zh } from "@/i18n/zh";
import { findUserByEmail, hashPassword, verifyPassword } from "./auth";
import { prisma } from "./db";
import { normalizeEmail } from "./email";
import { deliverPasswordChanged } from "./mail/notices";
import { logApiError } from "./server-log";
import { MailConfigError, sendPasswordResetEmail } from "./mail";
import { CODE_MAX_ATTEMPTS, CODE_TTL_MS, reserveSendWindow } from "./send-window";

export function resetMessages(dict: Dict = zh) {
  return {
    sent: (email: string) => dict.auth.codeSent.replaceAll("{email}", email),
    notRegistered: dict.auth.notRegistered,
    sendFailed: dict.auth.sendFailed,
    rateLimited: dict.auth.rateLimited,
    invalidCode: dict.auth.invalidCode,
    resetDone: dict.auth.resetDone,
    passwordRequired: dict.auth.passwordRequired,
    passwordShort: dict.auth.passwordShort,
    emailInvalid: dict.auth.emailInvalid,
  };
}

export type PasswordResetRequestResult =
  | { status: "sent"; email: string }
  | { status: "not_registered"; email: string }
  | { status: "rate_limited" }
  | { status: "send_failed" };

let dummyHash: Promise<string> | null = null;

function dummyCompare(code: string) {
  dummyHash ??= hashPassword("000000");
  return dummyHash.then((hash) => verifyPassword(code, hash));
}

export async function requestPasswordReset(input: {
  email: string;
  ip: string;
  requestId?: string;
}): Promise<PasswordResetRequestResult> {
  const email = normalizeEmail(input.email);
  const ip = input.ip.trim().slice(0, 64) || "unknown";
  const now = Date.now();
  const emailBucket = `email:${email}`;
  const ipBucket = `ip:${ip}`;

  // Count the attempt before the lookup so unknown addresses still spend the per-IP budget.
  const allowed = await reserveSendWindow([emailBucket, ipBucket], now);
  if (!allowed) return { status: "rate_limited" };

  const user = await findUserByEmail(email);
  if (!user) return { status: "not_registered", email };

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeHash = await hashPassword(code);
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
    const detail =
      error instanceof MailConfigError
        ? `password reset is not configured (${reason}). Console fallback was not used.`
        : `password reset send failed (${reason}). Console fallback was not used.`;
    logApiError({
      requestId: input.requestId || randomUUID(),
      route: "/api/auth/forgot-password",
      status: 500,
      error: new Error(detail),
    });
    return { status: "send_failed" };
  }
  return { status: "sent", email: user.email };
}

export async function resetPassword(input: {
  email: string;
  code: string;
  password: string;
}): Promise<{ ok: true; userId: string } | { ok: false; reason: "short" | "invalid" }> {
  if (input.password.length < 6 || input.password.length > 200) {
    await dummyCompare(input.code);
    return { ok: false, reason: "short" };
  }
  const user = await findUserByEmail(normalizeEmail(input.email));
  if (!user) {
    await dummyCompare(input.code);
    return { ok: false, reason: "invalid" };
  }

  let compared = false;
  const outcome = await prisma.$transaction(async (tx) => {
    const row = await tx.passwordResetCode.findUnique({ where: { userId: user.id } });
    if (!row || row.expiresAt.getTime() <= Date.now() || row.attempts >= CODE_MAX_ATTEMPTS) {
      if (row) await tx.passwordResetCode.delete({ where: { id: row.id } });
      return "invalid" as const;
    }

    const updated = await tx.passwordResetCode.updateMany({
      where: { id: row.id, attempts: { lt: CODE_MAX_ATTEMPTS } },
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
      if (after && after.attempts >= CODE_MAX_ATTEMPTS) {
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
  if (outcome !== "ok") return { ok: false, reason: "invalid" };
  await deliverPasswordChanged(user.email);
  return { ok: true, userId: user.id };
}
