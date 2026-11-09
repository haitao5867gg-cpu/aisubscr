import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createOrderFromItems } from "@/lib/orders";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const orders = await prisma.order.findMany({
    where: { userId: session.userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    let items = body.items as { productId: string; quantity: number }[] | undefined;
    if (!items || !items.length) {
      items = session.cart || [];
    }
    if (!items.length) return NextResponse.json({ error: "购物车为空" }, { status: 400 });
    const order = await createOrderFromItems(session.userId, items);
    session.cart = [];
    await session.save();
    return NextResponse.json({ order });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "下单失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
