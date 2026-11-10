import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { clientIp } from "@/lib/client-ip";
import { normalizeEmail } from "@/lib/email";
import { requestPasswordReset, resetMessages } from "@/lib/password-reset";
import { logApiError, requestIdFrom } from "@/lib/server-log";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const messages = resetMessages(getDict(await getLocale()));
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: messages.emailInvalid }, { status: 400 });
  }
  const record = typeof json === "object" && json !== null ? (json as { email?: unknown }) : {};
  const email = typeof record.email === "string" ? normalizeEmail(record.email) : record.email;
  const parsed = schema.safeParse({ email });
  if (!parsed.success) {
    return NextResponse.json({ error: messages.emailInvalid }, { status: 400 });
  }

  const requestId = requestIdFrom(req.headers);
  try {
    const result = await requestPasswordReset({
      email: parsed.data.email,
      ip: clientIp(req.headers),
      requestId,
    });
    if (result.status === "rate_limited") {
      return NextResponse.json({ error: messages.rateLimited }, { status: 429 });
    }
    if (result.status === "not_registered") {
      return NextResponse.json({
        status: "not_registered",
        email: result.email,
        message: messages.notRegistered,
      });
    }
    if (result.status === "send_failed") {
      return NextResponse.json({ error: messages.sendFailed }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      status: "sent",
      email: result.email,
      message: messages.sent(result.email),
    });
  } catch (error) {
    logApiError({ requestId, route: "/api/auth/forgot-password", status: 500, error });
    return NextResponse.json({ error: messages.sendFailed }, { status: 500 });
  }
}
