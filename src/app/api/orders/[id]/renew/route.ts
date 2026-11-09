import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createOrderFromItems } from "@/lib/orders";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const parent = await prisma.order.findFirst({
    where: { id, userId: session.userId },
    include: { items: true },
  });
  if (!parent) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  if (!["PAID", "COMPLETED"].includes(parent.status)) {
    return NextResponse.json({ error: "仅已支付/已完成订单可续费" }, { status: 400 });
  }
  const subItems = parent.items.filter((i) => i.isSubscription);
  if (!subItems.length) {
    return NextResponse.json({ error: "该订单不含可续费商品" }, { status: 400 });
  }
  const order = await createOrderFromItems(
    session.userId,
    subItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    { isRenewal: true, parentOrderId: parent.id }
  );
  return NextResponse.json({ order });
}
