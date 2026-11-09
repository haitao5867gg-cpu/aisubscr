import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword, resetMessages } from "@/lib/password-reset";
import { revokeCurrentSessionIfUser } from "@/lib/session";

const schema = z.object({
  email: z.string().email(),
  code: z.string(),
  password: z.string(),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: resetMessages.emailInvalid }, { status: 400 });
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
      return NextResponse.json({ error: resetMessages.passwordRequired }, { status: 400 });
    }
    return NextResponse.json({ error: resetMessages.emailInvalid }, { status: 400 });
  }
  if (parsed.data.password === "") {
    return NextResponse.json({ error: resetMessages.passwordRequired }, { status: 400 });
  }
  if (!/^\d{6}$/.test(parsed.data.code)) {
    return NextResponse.json({ error: resetMessages.invalidCode }, { status: 400 });
  }

  const result = await resetPassword(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: resetMessages.invalidCode }, { status: 400 });
  }
  await revokeCurrentSessionIfUser(result.userId);
  return NextResponse.json({ ok: true, message: resetMessages.resetDone });
}
