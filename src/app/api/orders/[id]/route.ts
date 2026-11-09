import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const order = await prisma.order.findFirst({
    where: { id, userId: session.userId },
    include: { items: true, tickets: { include: { replies: true } } },
  });
  if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  return NextResponse.json({ order });
}
