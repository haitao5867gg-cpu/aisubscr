import { NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { expireDueOrders } from "@/lib/order-expiry";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.api.loginRequired }, { status: 401 });
  }
  await expireDueOrders();
  const order = await prisma.order.findFirst({
    where: { id, userId: session.userId },
    include: { items: true, tickets: { include: { replies: true } } },
  });
  if (!order) return NextResponse.json({ error: t.api.orderMissing }, { status: 404 });
  return NextResponse.json({ order });
}
