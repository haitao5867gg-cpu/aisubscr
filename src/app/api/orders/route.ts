import { NextRequest, NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { recordCheckout } from "@/lib/analytics";
import { couponErrorMessage, isCouponError } from "@/lib/coupons";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createOrderFromItems } from "@/lib/orders";
import { expireDueOrders } from "@/lib/order-expiry";
import { logApiError, requestIdFrom } from "@/lib/server-log";

export async function GET() {
  const t = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.api.loginRequired }, { status: 401 });
  }
  await expireDueOrders();
  const orders = await prisma.order.findMany({
    where: { userId: session.userId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const t = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.auth.loginFailed }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    let items = body.items as { productId: string; quantity: number }[] | undefined;
    if (!items || !items.length) {
      items = session.cart || [];
    }
    if (!items.length) return NextResponse.json({ error: t.cart.empty }, { status: 400 });
    const couponCode = typeof body.couponCode === "string" ? body.couponCode : "";
    const order = await createOrderFromItems(session.userId, items, { couponCode });
    session.cart = [];
    await session.save();
    await recordCheckout(req.headers, order.id);
    return NextResponse.json({ order });
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : "";
    const couponMessage = isCouponError(e) ? couponErrorMessage(code, t) : null;
    if (!couponMessage && code !== "PRODUCT_NOT_FOUND" && code !== "EMPTY_CART" && code !== "OUT_OF_STOCK") {
      logApiError({ requestId: requestIdFrom(req.headers), route: "/api/orders", status: 400, error: e });
    }
    const msg =
      couponMessage ??
      (code === "PRODUCT_NOT_FOUND"
        ? t.shop.productMissing
        : code === "EMPTY_CART"
          ? t.cart.empty
          : code === "OUT_OF_STOCK"
            ? t.shop.outOfStock
            : t.shop.orderFailed);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
