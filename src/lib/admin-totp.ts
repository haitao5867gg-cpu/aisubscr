import QRCode from "qrcode";
import type { AuditActor } from "./audit";
import { writeAudit } from "./audit";
import { hashPassword, verifyPassword } from "./auth";
import { prisma } from "./db";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  isRecoveryCodeShape,
  matchTotpStep,
  normalizeRecoveryCode,
  otpauthUrl,
} from "./totp";

export async function beginTotpEnrollment(user: { id: string; email: string }) {
  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpPendingEnc: encryptTotpSecret(secret) },
  });
  const url = otpauthUrl(user.email, secret);
  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
  });
  return { secret, otpauthUrl: url, qrDataUrl };
}

export async function confirmTotpEnrollment(actor: AuditActor, code: string) {
  const user = await prisma.user.findUnique({
    where: { id: actor.actorId },
    select: { totpPendingEnc: true, totpEnabled: true },
  });
  if (!user?.totpPendingEnc) return { ok: false as const, reason: "missing" as const };
  const secret = decryptTotpSecret(user.totpPendingEnc);
  if (!secret) return { ok: false as const, reason: "invalid" as const };
  const step = matchTotpStep(secret, code);
  if (step === null) return { ok: false as const, reason: "invalid" as const };
  const recoveryCodes = generateRecoveryCodes();
  const hashes = await Promise.all(recoveryCodes.map((item) => hashPassword(normalizeRecoveryCode(item))));
  await prisma.$transaction(async (tx) => {
    await tx.totpRecoveryCode.deleteMany({ where: { userId: actor.actorId } });
    await tx.user.update({
      where: { id: actor.actorId },
      data: {
        totpSecretEnc: user.totpPendingEnc,
        totpPendingEnc: null,
        totpEnabled: true,
        totpEnabledAt: new Date(),
        totpLastStep: step,
      },
    });
    await tx.totpRecoveryCode.createMany({
      data: hashes.map((codeHash) => ({ userId: actor.actorId, codeHash })),
    });
    await writeAudit(tx, {
      ...actor,
      action: "totp.enable",
      targetType: "user",
      targetId: actor.actorId,
      note: "issued 10 recovery codes",
      before: { enabled: user.totpEnabled },
      after: { enabled: true },
    });
  });
  return { ok: true as const, recoveryCodes };
}

export async function disableTotp(actor: AuditActor, password: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: actor.actorId } });
  if (!user?.totpEnabled || !user.passwordHash) return { ok: false as const, reason: "missing" as const };
  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) return { ok: false as const, reason: "invalid" as const };
  const consumed = await consumeSecondFactor(user.id, code);
  if (!consumed) return { ok: false as const, reason: "invalid" as const };
  await prisma.$transaction(async (tx) => {
    await tx.totpRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: false,
        totpSecretEnc: null,
        totpPendingEnc: null,
        totpEnabledAt: null,
        totpLastStep: null,
      },
    });
    await writeAudit(tx, {
      ...actor,
      action: "totp.disable",
      targetType: "user",
      targetId: user.id,
      before: { enabled: true },
      after: { enabled: false },
    });
  });
  return { ok: true as const };
}

/** Burn a TOTP step or a single recovery code. A repeated code returns false. */
export async function consumeSecondFactor(userId: string, code: string) {
  const trimmed = code.trim();
  if (/^\d{6}$/.test(trimmed.replace(/\s+/g, ""))) return consumeTotp(userId, trimmed);
  if (isRecoveryCodeShape(trimmed)) return consumeRecovery(userId, trimmed);
  return false;
}

async function consumeTotp(userId: string, code: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabled: true, totpSecretEnc: true },
  });
  if (!user?.totpEnabled || !user.totpSecretEnc) return false;
  const secret = decryptTotpSecret(user.totpSecretEnc);
  if (!secret) return false;
  const step = matchTotpStep(secret, code);
  if (step === null) return false;
  const updated = await prisma.user.updateMany({
    where: {
      id: userId,
      totpEnabled: true,
      OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
    },
    data: { totpLastStep: step },
  });
  return updated.count === 1;
}

async function consumeRecovery(userId: string, code: string) {
  const normalized = normalizeRecoveryCode(code);
  const rows = await prisma.totpRecoveryCode.findMany({
    where: { userId, usedAt: null },
    select: { id: true, codeHash: true },
  });
  let matchId: string | null = null;
  for (const row of rows) {
    if (await verifyPassword(normalized, row.codeHash)) matchId = row.id;
  }
  if (!matchId) return false;
  const updated = await prisma.totpRecoveryCode.updateMany({
    where: { id: matchId, usedAt: null },
    data: { usedAt: new Date() },
  });
  return updated.count === 1;
}
