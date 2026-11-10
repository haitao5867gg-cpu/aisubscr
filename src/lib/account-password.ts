import { hashPassword, verifyPassword } from "./auth";
import { prisma } from "./db";
import { deliverPasswordChanged } from "./mail/notices";

export async function changePassword(input: { userId: string; currentPassword: string; newPassword: string }) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.disabled) return { ok: false as const, reason: "unauthorized" as const };
  const currentOk = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!currentOk) return { ok: false as const, reason: "current" as const };
  if (input.newPassword.length < 6) return { ok: false as const, reason: "short" as const };
  if (await verifyPassword(input.newPassword, user.passwordHash)) {
    return { ok: false as const, reason: "same" as const };
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      sessionVersion: { increment: 1 },
    },
    select: { sessionVersion: true, email: true },
  });
  await deliverPasswordChanged(updated.email);
  return { ok: true as const, sessionVersion: updated.sessionVersion, email: updated.email };
}
