import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Completes MOCK payment and redirects to order page. Clearly 模拟支付. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const method = req.nextUrl.searchParams.get("method") || "MOCK";
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (order.status === "PENDING") {
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
  return NextResponse.redirect(new URL(`/orders/${id}?paid=1`, req.url));
}
