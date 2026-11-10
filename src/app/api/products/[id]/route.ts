import { NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  const { id } = await params;
  const product = await prisma.product.findFirst({ where: { id, active: true } });
  if (!product) return NextResponse.json({ error: t.api.productMissing }, { status: 404 });
  return NextResponse.json({ product });
}
