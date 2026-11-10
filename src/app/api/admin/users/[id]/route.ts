import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

const schema = z.object({
  disabled: z.boolean(),
});

function userSnapshot(user: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  disabled: boolean;
  sessionVersion: number;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    disabled: user.disabled,
    sessionVersion: user.sessionVersion,
  };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  try {
    await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      disabled: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
    },
  });
  if (!user) return NextResponse.json({ error: t.admin.userMissing }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.admin.actionFailed }, { status: 400 });
  if (parsed.data.disabled && session.userId === id) {
    return NextResponse.json({ error: t.admin.cannotDisableSelf }, { status: 400 });
  }
  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: t.admin.userMissing }, { status: 404 });
  if (before.disabled === parsed.data.disabled) {
    return NextResponse.json({ user: userSnapshot(before) });
  }
  const actor = actorFrom(session);
  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: parsed.data.disabled
        ? { disabled: true, sessionVersion: { increment: 1 } }
        : { disabled: false },
    });
    await writeAudit(tx, {
      ...actor,
      action: parsed.data.disabled ? "user.disable" : "user.enable",
      targetType: "user",
      targetId: id,
      before: userSnapshot(before),
      after: userSnapshot(updated),
    });
    return updated;
  });
  return NextResponse.json({ user: userSnapshot(user) });
}
