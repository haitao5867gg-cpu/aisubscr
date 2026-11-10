import { NextRequest, NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { clientIp } from "@/lib/client-ip";
import { prisma } from "@/lib/db";
import { requestPasswordReset } from "@/lib/password-reset";
import { requestIdFrom } from "@/lib/server-log";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: t.admin.userMissing }, { status: 404 });

  const result = await requestPasswordReset({
    email: user.email,
    ip: clientIp(req.headers),
    requestId: requestIdFrom(req.headers),
  });
  if (result.status === "rate_limited") {
    return NextResponse.json({ error: t.auth.rateLimited }, { status: 429 });
  }
  if (result.status !== "sent") {
    return NextResponse.json({ error: t.auth.sendFailed }, { status: 502 });
  }

  await writeAudit(prisma, {
    ...actorFrom(session),
    action: "user.password_reset",
    targetType: "user",
    targetId: user.id,
    before: { email: user.email },
    after: { email: user.email, resetEmail: "sent" },
  });
  return NextResponse.json({ ok: true });
}
