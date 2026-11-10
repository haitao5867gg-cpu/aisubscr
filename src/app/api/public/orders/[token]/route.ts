import { NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/db";
import { expireDueOrders } from "@/lib/order-expiry";

/** Public shareable order view by unguessable token */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const t = getDict(await getLocale());
  const { token } = await params;
  await expireDueOrders();
  const order = await prisma.order.findFirst({
    where: { publicToken: token },
    include: {
      items: true,
      tickets: {
        orderBy: { createdAt: "desc" },
        include: { replies: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!order) return NextResponse.json({ error: t.api.orderMissing }, { status: 404 });
  return NextResponse.json({
    order: {
      id: order.id,
      orderNo: order.orderNo,
      publicToken: order.publicToken,
      status: order.status,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      couponCode: order.couponCode,
      totalCents: order.totalCents,
      expiresAt: order.expiresAt,
      paymentMethod: order.paymentMethod,
      paymentProvider: order.paymentProvider,
      paidAt: order.paidAt,
      isRenewal: order.isRenewal,
      createdAt: order.createdAt,
      items: order.items,
      tickets: order.tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt,
        replies: t.replies.map((r) => ({
          id: r.id,
          body: r.body,
          isStaff: r.isStaff,
          createdAt: r.createdAt,
        })),
      })),
    },
  });
}
