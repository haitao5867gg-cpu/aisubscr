import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { productPatchData, productPatchSchema, productSnapshot } from "@/lib/product-input";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

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
  const parsed = productPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.admin.invalidProduct }, { status: 400 });
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: t.shop.productMissing }, { status: 404 });
  const actor = actorFrom(session);
  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id }, data: productPatchData(parsed.data) });
    await writeAudit(tx, {
      ...actor,
      action: "product.update",
      targetType: "product",
      targetId: id,
      before: productSnapshot(before),
      after: productSnapshot(updated),
    });
    return updated;
  });
  return NextResponse.json({ product });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const before = await prisma.product.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: t.shop.productMissing }, { status: 404 });
  const references = await prisma.orderItem.count({ where: { productId: id } });
  const actor = actorFrom(session);
  if (references > 0) {
    const hidden = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id }, data: { active: false } });
      await writeAudit(tx, {
        ...actor,
        action: "product.hide",
        targetType: "product",
        targetId: id,
        before: productSnapshot(before),
        after: productSnapshot(updated),
        note: "ordered",
      });
      return updated;
    });
    return NextResponse.json({ ok: true, hidden: true, product: hidden });
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.delete({ where: { id } });
      await writeAudit(tx, {
        ...actor,
        action: "product.delete",
        targetType: "product",
        targetId: id,
        before: productSnapshot(before),
        after: null,
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json({ error: t.admin.actionFailed }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true, hidden: false });
}
