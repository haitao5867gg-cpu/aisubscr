import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { confirmEmailChange } from "@/lib/email-change";
import { deliverEmailChanged } from "@/lib/mail/notices";
import { requireUser } from "@/lib/session";

const schema = z.object({
  email: z.string().email(),
  code: z.string(),
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
  if (!/^\d{6}$/.test(parsed.data.code)) {
    return NextResponse.json({ error: t.auth.invalidCode }, { status: 400 });
  }
  if (!session.userId) return NextResponse.json({ error: t.auth.loginFailed }, { status: 401 });

  const result = await confirmEmailChange({
    userId: session.userId,
    email: parsed.data.email,
    code: parsed.data.code,
  });
  if (!result.ok) {
    const error = result.reason === "taken" ? t.security.emailTaken : t.auth.invalidCode;
    const status = result.reason === "taken" ? 409 : 400;
    return NextResponse.json({ error }, { status });
  }
  await deliverEmailChanged(result.oldEmail, result.email);
  session.email = result.email;
  session.sessionVersion = result.sessionVersion;
  await session.save();
  return NextResponse.json({ ok: true, email: result.email, message: t.security.emailChanged });
}
