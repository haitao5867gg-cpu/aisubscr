import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { zh } from "@/i18n/zh";
import { peekLoginLimit, recordLoginFailure } from "@/lib/auth-rate-limit";
import { findUserByEmail, hashPassword, verifyPassword } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { normalizeEmail } from "@/lib/email";
import { getSession } from "@/lib/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

let dummyHash: Promise<string> | null = null;

function dummyPasswordCompare(password: string) {
  dummyHash ??= hashPassword("aisubscr-login-timing-pad");
  return dummyHash.then((hash) => verifyPassword(password, hash));
}

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "登录失败" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "邮箱或密码错误" }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const ip = clientIp(req.headers);
  try {
    const limit = await peekLoginLimit(email, ip);
    if (limit.limited) {
      return NextResponse.json(
        { error: zh.auth.loginRateLimited },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const user = await findUserByEmail(email);
    const passwordOk = user
      ? await verifyPassword(parsed.data.password, user.passwordHash)
      : await dummyPasswordCompare(parsed.data.password);
    if (!user || !passwordOk) {
      await recordLoginFailure(email, ip);
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });
    }

    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.role = user.role;
    session.name = user.name || undefined;
    session.sessionVersion = user.sessionVersion;
    session.isLoggedIn = true;
    if (!session.cart) session.cart = [];
    await session.save();
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "登录失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
