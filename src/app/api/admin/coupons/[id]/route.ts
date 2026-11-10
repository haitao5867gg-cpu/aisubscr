import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { couponSnapshot, couponWriteData, couponWriteSchema } from "@/lib/coupon-input";
import { prisma } from "@/lib/db";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const { id } = await params;
  const parsed = couponWriteSchema.safeParse(await req.json().catch(() => null));
  const data = parsed.success ? couponWriteData(parsed.data) : null;
  if (!data) return NextResponse.json({ error: t.admin.invalidCoupon }, { status: 400 });
  const before = await prisma.coupon.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: t.admin.couponMissing }, { status: 404 });
  const actor = actorFrom(session);
  try {
    const coupon = await prisma.$transaction(async (tx) => {
      const saved = await tx.coupon.update({ where: { id }, data });
      await writeAudit(tx, {
        ...actor,
        action: "coupon.update",
        targetType: "coupon",
        targetId: id,
        before: couponSnapshot(before),
        after: couponSnapshot(saved),
      });
      return saved;
    });
    return NextResponse.json({ coupon });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: t.admin.couponTaken }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const { id } = await params;
  const before = await prisma.coupon.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: t.admin.couponMissing }, { status: 404 });
  const used = await prisma.couponRedemption.count({ where: { couponId: id } });
  if (used > 0) return NextResponse.json({ error: t.admin.couponInUse }, { status: 409 });
  const actor = actorFrom(session);
  await prisma.$transaction(async (tx) => {
    await tx.coupon.delete({ where: { id } });
    await writeAudit(tx, {
      ...actor,
      action: "coupon.delete",
      targetType: "coupon",
      targetId: id,
      before: couponSnapshot(before),
    });
  });
  return NextResponse.json({ ok: true });
}
