import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

/**
 * Completes MOCK payment for the signed-in owner.
 * POST only: a cross-site GET would otherwise send the SameSite=Lax cookie.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const order = await prisma.order.findFirst({ where: { id, userId: session.userId } });
  if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  if (order.status === "PENDING") {
    const method = req.nextUrl.searchParams.get("method") || "MOCK";
    await prisma.order.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: method,
        paymentProvider: "MOCK",
      },
    });
  }
  return NextResponse.json({ ok: true, redirect: `/orders/${id}?paid=1` });
}

export function GET() {
  return NextResponse.json({ error: "请使用支付页面完成模拟支付" }, { status: 405 });
}
