import { NextRequest, NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { adminOrderWhere, ordersToCsv, readOrderFilters } from "@/lib/admin-orders";
import { prisma } from "@/lib/db";
import { adminAuthResponse, requireAdmin } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    const denied = await adminAuthResponse(error);
    if (denied) return denied;
    throw error;
  }
  const orders = await prisma.order.findMany({
    where: adminOrderWhere(readOrderFilters(req.nextUrl.searchParams)),
    include: { items: true, user: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });
  const t = getDict(await getLocale());
  const labels = t.admin.csv;
  return new NextResponse(
    ordersToCsv(orders, [labels.orderNo, labels.email, labels.status, labels.amount, labels.pay, labels.created, labels.paid, labels.items]),
    {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orders.csv"',
      "Cache-Control": "no-store",
    },
  });
}
