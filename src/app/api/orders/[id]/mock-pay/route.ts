import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Completes MOCK payment and redirects to order page. Clearly 模拟支付. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const method = req.nextUrl.searchParams.get("method") || "MOCK";
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.redirect(new URL("/", publicOrigin(req)), 303);
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
  return NextResponse.redirect(new URL(`/orders/${id}?paid=1`, publicOrigin(req)), 303);
}

/** `next start -H 0.0.0.0` reports that bind address as the request origin, which drops the session cookie. */
function publicOrigin(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  if (forwarded && !forwarded.startsWith("0.0.0.0")) return `${proto}://${forwarded}`;
  const origin = req.nextUrl.origin;
  if (!origin.includes("0.0.0.0")) return origin;
  return "http://localhost:3000";
}
