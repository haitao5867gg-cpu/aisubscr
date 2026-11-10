import { prisma } from "./db";

export async function adminTotpState(userId: string) {
  const [user, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { totpEnabled: true } }),
    prisma.siteSetting.findUnique({ where: { id: "default" }, select: { adminTotpRequired: true } }),
  ]);
  const enabled = Boolean(user?.totpEnabled);
  const required = Boolean(settings?.adminTotpRequired);
  return { enabled, required, blocked: required && !enabled };
}
