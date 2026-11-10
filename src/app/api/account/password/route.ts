import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { changePassword } from "@/lib/account-password";
import { requireUser } from "@/lib/session";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1).max(200),
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
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const record = typeof json === "object" && json ? (json as Record<string, unknown>) : {};
    if (typeof record.newPassword === "string" && record.newPassword.length > 0 && record.newPassword.length < 6) {
      return NextResponse.json({ error: t.auth.passwordShort }, { status: 400 });
    }
    return NextResponse.json({ error: t.common.fieldRequired }, { status: 400 });
  }
  if (parsed.data.newPassword.length < 6) {
    return NextResponse.json({ error: t.auth.passwordShort }, { status: 400 });
  }
  if (!session.userId) return NextResponse.json({ error: t.auth.loginFailed }, { status: 401 });

  const result = await changePassword({
    userId: session.userId,
    currentPassword: parsed.data.currentPassword,
    newPassword: parsed.data.newPassword,
  });
  if (!result.ok) {
    if (result.reason === "short") return NextResponse.json({ error: t.auth.passwordShort }, { status: 400 });
    if (result.reason === "same") return NextResponse.json({ error: t.security.passwordSame }, { status: 400 });
    if (result.reason === "current") return NextResponse.json({ error: t.security.currentPasswordWrong }, { status: 400 });
    return NextResponse.json({ error: t.auth.loginFailed }, { status: 401 });
  }
  session.sessionVersion = result.sessionVersion;
  session.email = result.email;
  await session.save();
  return NextResponse.json({ ok: true, message: t.security.passwordChanged });
}
