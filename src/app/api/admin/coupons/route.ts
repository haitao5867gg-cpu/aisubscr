import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { couponSnapshot, couponWriteData, couponWriteSchema } from "@/lib/coupon-input";
import { prisma } from "@/lib/db";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ coupons });
}

export async function POST(req: NextRequest) {
  const t = getDict(await getLocale());
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const parsed = couponWriteSchema.safeParse(await req.json().catch(() => null));
  const data = parsed.success ? couponWriteData(parsed.data) : null;
  if (!data) return NextResponse.json({ error: t.admin.invalidCoupon }, { status: 400 });
  const actor = actorFrom(session);
  try {
    const coupon = await prisma.$transaction(async (tx) => {
      const created = await tx.coupon.create({ data });
      await writeAudit(tx, {
        ...actor,
        action: "coupon.create",
        targetType: "coupon",
        targetId: created.id,
        after: couponSnapshot(created),
      });
      return created;
    });
    return NextResponse.json({ coupon });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: t.admin.couponTaken }, { status: 409 });
    }
    throw error;
  }
}
