import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { confirmTotpEnrollment } from "@/lib/admin-totp";
import { actorFrom } from "@/lib/audit";
import { peekTotpLimit, recordTotpFailure } from "@/lib/auth-rate-limit";
import { clientIp } from "@/lib/client-ip";
import { adminAuthResponse, requireAdminUser } from "@/lib/session";

const schema = z.object({
  code: z.string().trim().min(1).max(32),
});

export async function POST(req: NextRequest) {
  const t = getDict(await getLocale());
  let session;
  try {
    session = await requireAdminUser();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.auth.totpInvalid }, { status: 400 });
  const actor = actorFrom(session);
  const ip = clientIp(req.headers);
  const limit = await peekTotpLimit(actor.actorEmail, ip);
  if (limit.limited) {
    return NextResponse.json(
      { error: t.auth.loginRateLimited },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const result = await confirmTotpEnrollment(actor, parsed.data.code);
  if (!result.ok) {
    await recordTotpFailure(actor.actorEmail, ip);
    return NextResponse.json({ error: t.auth.totpInvalid }, { status: 400 });
  }
  return NextResponse.json({ enabled: true, recoveryCodes: result.recoveryCodes });
}
