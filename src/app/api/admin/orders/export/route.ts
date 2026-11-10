import { NextRequest, NextResponse } from "next/server";
import { adminOrderWhere, ordersToCsv, readOrderFilters } from "@/lib/admin-orders";
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
  const orders = await prisma.order.findMany({
    where: adminOrderWhere(readOrderFilters(req.nextUrl.searchParams)),
    include: { items: true, user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });
  return new NextResponse(ordersToCsv(orders), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orders.csv"',
      "Cache-Control": "no-store",
    },
  });
}
