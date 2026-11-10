import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { resetPassword, resetMessages } from "@/lib/password-reset";
import { revokeCurrentSessionIfUser } from "@/lib/session";

const schema = z.object({
  email: z.string().email(),
  code: z.string(),
  password: z.string(),
});

export async function POST(req: NextRequest) {
  const messages = resetMessages(getDict(await getLocale()));
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: messages.emailInvalid }, { status: 400 });
  }
  const record = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  const email = typeof record.email === "string" ? record.email.trim() : record.email;
  const parsed = schema.safeParse({
    email,
    code: record.code,
    password: record.password,
  });
  if (!parsed.success) {
    if (typeof record.password !== "string") {
      return NextResponse.json({ error: messages.passwordRequired }, { status: 400 });
    }
    return NextResponse.json({ error: messages.emailInvalid }, { status: 400 });
  }
  if (parsed.data.password === "") {
    return NextResponse.json({ error: messages.passwordRequired }, { status: 400 });
  }
  if (!/^\d{6}$/.test(parsed.data.code)) {
    return NextResponse.json({ error: messages.invalidCode }, { status: 400 });
  }

  const result = await resetPassword(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: messages.invalidCode }, { status: 400 });
  }
  await revokeCurrentSessionIfUser(result.userId);
  return NextResponse.json({ ok: true, message: messages.resetDone });
}
