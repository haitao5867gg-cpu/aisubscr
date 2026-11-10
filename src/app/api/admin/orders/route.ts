import { NextRequest, NextResponse } from "next/server";
import { adminOrderWhere, readOrderFilters } from "@/lib/admin-orders";
import { prisma } from "@/lib/db";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const filters = readOrderFilters(req.nextUrl.searchParams);
  const orders = await prisma.order.findMany({
    where: adminOrderWhere(filters),
    include: { items: true, user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ orders });
}
