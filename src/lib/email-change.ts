import { randomInt } from "crypto";
import { getT } from "@/i18n/server";
import { hashPassword, verifyPassword } from "./auth";
import { prisma } from "./db";
import { normalizeEmail } from "./email";
import { emailChangeCodeNotice } from "./mail/notices";
import { getMailer, MailConfigError } from "./mail";
import { logApiError } from "./server-log";
import { CODE_MAX_ATTEMPTS, CODE_TTL_MS, reserveSendWindow } from "./send-window";

let dummyHash: Promise<string> | null = null;

function dummyCompare(code: string) {
  dummyHash ??= hashPassword("000000");
  return dummyHash.then((hash) => verifyPassword(code, hash));
}

export type EmailChangeRequestResult =
  | { status: "sent"; email: string }
  | { status: "same" }
  | { status: "taken" }
  | { status: "rate_limited" }
  | { status: "send_failed" };

export async function requestEmailChange(input: {
  userId: string;
  email: string;
  ip: string;
  requestId?: string;
}): Promise<EmailChangeRequestResult> {
  const nextEmail = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.disabled) return { status: "send_failed" };
  if (nextEmail === user.email) return { status: "same" };

  const ip = input.ip.trim().slice(0, 64) || "unknown";
  const allowed = await reserveSendWindow(
    [`email-change:email:${nextEmail}`, `email-change:user:${user.id}`, `email-change:ip:${ip}`],
    Date.now(),
  );
  if (!allowed) return { status: "rate_limited" };

  const taken = await prisma.user.findUnique({ where: { email: nextEmail } });
  if (taken) return { status: "taken" };

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await prisma.emailChangeCode.upsert({
    where: { userId: user.id },
    create: { userId: user.id, newEmail: nextEmail, codeHash, expiresAt, attempts: 0 },
    update: { newEmail: nextEmail, codeHash, expiresAt, attempts: 0, createdAt: new Date() },
  });

  try {
    const notice = emailChangeCodeNotice(code, await getT());
    await getMailer().send({ to: nextEmail, ...notice });
  } catch (error) {
    await prisma.emailChangeCode.deleteMany({ where: { userId: user.id } });
    const reason = error instanceof Error ? error.message : "send failed";
    const detail =
      error instanceof MailConfigError
        ? `email change is not configured (${reason}). Console fallback was not used.`
        : `email change send failed (${reason}). Console fallback was not used.`;
    logApiError({
      requestId: input.requestId || "email-change",
      route: "/api/account/email",
      status: 500,
      error: new Error(detail),
    });
    return { status: "send_failed" };
  }
  return { status: "sent", email: nextEmail };
}

export async function confirmEmailChange(input: {
  userId: string;
  email: string;
  code: string;
}): Promise<{ ok: true; oldEmail: string; email: string } | { ok: false; reason: "invalid" | "taken" }> {
  const nextEmail = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.disabled) {
    await dummyCompare(input.code);
    return { ok: false, reason: "invalid" };
  }

  let compared = false;
  const outcome = await prisma.$transaction(async (tx) => {
    const row = await tx.emailChangeCode.findUnique({ where: { userId: user.id } });
    if (!row || row.newEmail !== nextEmail || row.expiresAt.getTime() <= Date.now() || row.attempts >= CODE_MAX_ATTEMPTS) {
      if (row && (row.expiresAt.getTime() <= Date.now() || row.attempts >= CODE_MAX_ATTEMPTS)) {
        await tx.emailChangeCode.delete({ where: { id: row.id } });
      }
      return "invalid" as const;
    }

    const updated = await tx.emailChangeCode.updateMany({
      where: { id: row.id, attempts: { lt: CODE_MAX_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (updated.count !== 1) {
      await tx.emailChangeCode.deleteMany({ where: { id: row.id } });
      return "invalid" as const;
    }

    compared = true;
    const match = await verifyPassword(input.code, row.codeHash);
    if (!match) {
      const after = await tx.emailChangeCode.findUnique({ where: { id: row.id } });
      if (after && after.attempts >= CODE_MAX_ATTEMPTS) {
        await tx.emailChangeCode.delete({ where: { id: row.id } });
      }
      return "invalid" as const;
    }

    const owner = await tx.user.findUnique({ where: { email: nextEmail } });
    if (owner && owner.id !== user.id) {
      await tx.emailChangeCode.delete({ where: { id: row.id } });
      return "taken" as const;
    }

    await tx.user.update({ where: { id: user.id }, data: { email: nextEmail } });
    await tx.emailChangeCode.delete({ where: { id: row.id } });
    return "ok" as const;
  }, { timeout: 15000 });

  if (!compared) await dummyCompare(input.code);
  if (outcome === "taken") return { ok: false, reason: "taken" };
  if (outcome !== "ok") return { ok: false, reason: "invalid" };
  return { ok: true, oldEmail: user.email, email: nextEmail };
}
