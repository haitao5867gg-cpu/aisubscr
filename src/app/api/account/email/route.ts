import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { clientIp } from "@/lib/client-ip";
import { requestEmailChange } from "@/lib/email-change";
import { requestIdFrom } from "@/lib/server-log";
import { requireUser } from "@/lib/session";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const t = getDict(await getLocale());
  let session;
  try {
    session = await requireUser();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: t.auth.loginFailed }, { status: 401 });
    }
    throw error;
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.auth.emailInvalid }, { status: 400 });
  if (!session.userId) return NextResponse.json({ error: t.auth.loginFailed }, { status: 401 });

  const result = await requestEmailChange({
    userId: session.userId,
    email: parsed.data.email,
    ip: clientIp(req.headers),
    requestId: requestIdFrom(req.headers),
  });
  if (result.status === "same") return NextResponse.json({ error: t.security.emailSame }, { status: 400 });
  if (result.status === "taken") return NextResponse.json({ error: t.security.emailTaken }, { status: 409 });
  if (result.status === "rate_limited") return NextResponse.json({ error: t.auth.rateLimited }, { status: 429 });
  if (result.status === "send_failed") return NextResponse.json({ error: t.auth.sendFailed }, { status: 502 });
  return NextResponse.json({
    ok: true,
    email: result.email,
    message: t.security.emailCodeSent.replaceAll("{email}", result.email),
  });
}
