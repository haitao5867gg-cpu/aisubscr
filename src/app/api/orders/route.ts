import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { recordCheckout } from "@/lib/analytics";
import { couponErrorMessage, isCouponError } from "@/lib/coupons";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createOrderFromItems } from "@/lib/orders";
import { expireDueOrders } from "@/lib/order-expiry";
import { refreshPublic } from "@/lib/public-content";
import { logApiError, requestIdFrom } from "@/lib/server-log";

const checkoutItems = z
  .array(
    z.object({
      productId: z.string().trim().min(1).max(80),
      quantity: z.number().int().min(1).max(99),
    }),
  )
  .max(30);

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
    const record = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
    let items = session.cart || [];
    if (Array.isArray(record.items) && record.items.length > 0) {
      const parsed = checkoutItems.safeParse(record.items);
      if (!parsed.success) return NextResponse.json({ error: t.shop.invalidQuantity }, { status: 400 });
      items = parsed.data;
    }
    if (!items.length) return NextResponse.json({ error: t.cart.empty }, { status: 400 });
    const couponCode = typeof record.couponCode === "string" ? record.couponCode : "";
    const order = await createOrderFromItems(session.userId, items, { couponCode });
    session.cart = [];
    await session.save();
    refreshPublic("catalog");
    await recordCheckout(req.headers, order.id);
    return NextResponse.json({ order });
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : "";
    const couponMessage = isCouponError(e) ? couponErrorMessage(code, t) : null;
    const known =
      Boolean(couponMessage) ||
      code === "PRODUCT_NOT_FOUND" ||
      code === "EMPTY_CART" ||
      code === "OUT_OF_STOCK" ||
      code === "INVALID_ITEMS";
    if (!known) {
      logApiError({ requestId: requestIdFrom(req.headers), route: "/api/orders", status: 500, error: e });
      return NextResponse.json({ error: t.shop.orderFailed }, { status: 500 });
    }
    const msg =
      couponMessage ??
      (code === "PRODUCT_NOT_FOUND"
        ? t.shop.productMissing
        : code === "EMPTY_CART"
          ? t.cart.empty
          : code === "OUT_OF_STOCK"
            ? t.shop.outOfStock
            : code === "INVALID_ITEMS"
              ? t.shop.invalidQuantity
              : t.shop.orderFailed);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
