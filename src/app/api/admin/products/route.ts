import { NextRequest, NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { actorFrom, writeAudit } from "@/lib/audit";
import { catalogOrderBy } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { imageFieldRejected, productCreateData, productCreateSchema, productSnapshot } from "@/lib/product-input";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const products = await prisma.product.findMany({ orderBy: catalogOrderBy });
  return NextResponse.json({ products });
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
  const parsed = productCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: imageFieldRejected(parsed.error) ? t.admin.imageInvalid : t.admin.invalidProduct },
      { status: 400 },
    );
  }
  const actor = actorFrom(session);
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({ data: productCreateData(parsed.data) });
    await writeAudit(tx, {
      ...actor,
      action: "product.create",
      targetType: "product",
      targetId: created.id,
      after: productSnapshot(created),
    });
    return created;
  });
  return NextResponse.json({ product });
}
