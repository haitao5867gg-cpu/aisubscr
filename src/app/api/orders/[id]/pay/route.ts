import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getPaymentProvider, type PaymentMethod } from "@/lib/payments";

const schema = z.object({
  method: z.enum(["WECHAT", "ALIPAY", "MOCK"]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const order = await prisma.order.findFirst({ where: { id, userId: session.userId } });
  if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  if (order.status !== "PENDING") {
    return NextResponse.json({ error: "订单状态不可支付" }, { status: 400 });
  }
  const { method } = schema.parse(await req.json());
  const provider = getPaymentProvider(method as PaymentMethod);
  const origin = req.nextUrl.origin;
  const result = await provider.createPayment({
    orderId: order.id,
    orderNo: order.orderNo,
    amountCents: order.totalCents,
    method: method as PaymentMethod,
    returnUrl: `${origin}/orders/${order.id}`,
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentMethod: method, paymentProvider: result.provider },
  });
  return NextResponse.json({ payment: result });
}
