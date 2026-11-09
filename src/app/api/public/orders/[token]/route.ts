import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Public shareable order view by unguessable token */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
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
  if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  return NextResponse.json({
    order: {
      id: order.id,
      orderNo: order.orderNo,
      publicToken: order.publicToken,
      status: order.status,
      totalCents: order.totalCents,
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
