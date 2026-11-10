import { NextResponse } from "next/server";
import { catalogOrderBy } from "@/lib/catalog";
import { prisma } from "@/lib/db";

export async function GET() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: catalogOrderBy,
  });
  return NextResponse.json({ products });
}
