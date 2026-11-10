import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { getPaymentProvider, PaymentProviderNotReadyError, type PaymentMethod } from "@/lib/payments";
import { getSession } from "@/lib/session";
import { siteUrl } from "@/lib/site";

const schema = z.object({
  method: z.enum(["WECHAT", "ALIPAY", "MOCK"]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = getDict(await getLocale());
  const { id } = await params;
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.auth.loginFailed }, { status: 401 });
  }
  const order = await prisma.order.findFirst({ where: { id, userId: session.userId } });
  if (!order) return NextResponse.json({ error: t.shop.productMissing }, { status: 404 });
  if (order.status !== "PENDING" && order.status !== "PAYING") {
    return NextResponse.json({ error: t.payment.payFailed }, { status: 400 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.payment.payFailed }, { status: 400 });
  const method = parsed.data.method as PaymentMethod;
  const provider = getPaymentProvider(method);
  try {
    const result = await provider.createPayment({
      orderId: order.id,
      orderNo: order.orderNo,
      amountCents: order.totalCents,
      method,
      returnUrl: `${siteUrl()}/orders/${order.id}`,
      notifyUrl: `${siteUrl()}/api/payments/notify/${provider.name.toLowerCase()}`,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentMethod: method, paymentProvider: result.provider, status: "PAYING" },
    });
    return NextResponse.json({ payment: result });
  } catch (error) {
    if (error instanceof PaymentProviderNotReadyError) {
      return NextResponse.json({ error: t.payment.notReady }, { status: 501 });
    }
    throw error;
  }
}
