import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/client-ip";
import { MailConfigError } from "@/lib/mail";
import { requestPasswordReset, resetMessages } from "@/lib/password-reset";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: resetMessages.emailInvalid }, { status: 400 });
  }
  const record = typeof json === "object" && json !== null ? (json as { email?: unknown }) : {};
  const email = typeof record.email === "string" ? record.email.trim() : record.email;
  const parsed = schema.safeParse({ email });
  if (!parsed.success) {
    return NextResponse.json({ error: resetMessages.emailInvalid }, { status: 400 });
  }

  try {
    const result = await requestPasswordReset({
      email: parsed.data.email,
      ip: clientIp(req.headers),
    });
    if (result === "rate_limited") {
      return NextResponse.json({ error: resetMessages.rateLimited }, { status: 429 });
    }
    return NextResponse.json({ ok: true, message: resetMessages.sent });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "request failed";
    if (error instanceof MailConfigError) {
      console.error(`[aisubscr mail] ${reason}`);
    } else {
      console.error("[aisubscr] forgot-password failed", reason);
    }
    return NextResponse.json({ error: "发送失败，请稍后再试" }, { status: 500 });
  }
}
