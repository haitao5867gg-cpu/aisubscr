import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createUser, findUserByEmail } from "@/lib/auth";
import { getSession } from "@/lib/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const existing = await findUserByEmail(body.email);
    if (existing) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 400 });
    }
    const user = await createUser(body.email, body.password, body.name);
    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.role = user.role;
    session.name = user.name || undefined;
    session.isLoggedIn = true;
    if (!session.cart) session.cart = [];
    await session.save();
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "注册失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
