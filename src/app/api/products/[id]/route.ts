import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findFirst({ where: { id, active: true } });
  if (!product) return NextResponse.json({ error: "商品不存在" }, { status: 404 });
  return NextResponse.json({ product });
}
