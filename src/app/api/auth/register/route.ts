import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { consumeRegisterAttempt } from "@/lib/auth-rate-limit";
import { createUser, findUserByEmail } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { normalizeEmail } from "@/lib/email";
import { getSession } from "@/lib/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const t = getDict(await getLocale());
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: t.auth.registerFailed }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const password = typeof json === "object" && json && "password" in json ? (json as { password?: unknown }).password : "";
    if (typeof password === "string" && password.length > 0 && password.length < 6) {
      return NextResponse.json({ error: t.auth.passwordShort }, { status: 400 });
    }
    return NextResponse.json({ error: t.auth.registerFailed }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  try {
    const limit = await consumeRegisterAttempt(email, clientIp(req.headers));
    if (limit.limited) {
      return NextResponse.json(
        { error: t.auth.registerRateLimited },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: t.auth.emailTaken }, { status: 400 });
    }
    const user = await createUser(email, parsed.data.password, parsed.data.name);
    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.role = user.role;
    session.name = user.name || undefined;
    session.sessionVersion = user.sessionVersion;
    session.isLoggedIn = true;
    if (!session.cart) session.cart = [];
    await session.save();
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch {
    console.error("[aisubscr] register failed");
    return NextResponse.json({ error: t.auth.registerFailed }, { status: 400 });
  }
}
