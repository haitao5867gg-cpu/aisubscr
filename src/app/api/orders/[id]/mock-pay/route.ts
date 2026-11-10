import { NextRequest, NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { confirmOrderPayment } from "@/lib/payments/confirm";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

/**
 * Completes MOCK payment for the signed-in owner.
 * POST only: a cross-site GET would otherwise send the SameSite=Lax cookie.
 * The payment id is the idempotency key, so a double submit does not pay twice.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.auth.loginFailed }, { status: 401 });
  }
  const order = await prisma.order.findFirst({ where: { id, userId: session.userId } });
  if (!order) return NextResponse.json({ error: t.shop.orderFailed }, { status: 404 });

  const methodParam = req.nextUrl.searchParams.get("method");
  const method = methodParam === "WECHAT" || methodParam === "ALIPAY" || methodParam === "MOCK" ? methodParam : "MOCK";
  const paymentId = req.nextUrl.searchParams.get("paymentId")?.slice(0, 120) || `mock-session-${order.id}`;

  const result = await confirmOrderPayment({
    orderNo: order.orderNo,
    provider: "MOCK",
    providerEventId: paymentId,
    amountCents: order.totalCents,
    method,
    success: true,
  });
  if (!result.ok) return NextResponse.json({ error: t.payment.payFailed }, { status: 400 });
  return NextResponse.json({ ok: true, redirect: `/orders/${id}?paid=1`, duplicate: result.duplicate });
}

export function GET() {
  return NextResponse.json({ error: "请使用支付页面完成模拟支付" }, { status: 405 });
}
