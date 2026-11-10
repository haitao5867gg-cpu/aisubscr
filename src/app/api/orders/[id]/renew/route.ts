import { NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createOrderFromItems } from "@/lib/orders";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.api.loginRequired }, { status: 401 });
  }
  const parent = await prisma.order.findFirst({
    where: { id, userId: session.userId },
    include: { items: true },
  });
  if (!parent) return NextResponse.json({ error: t.api.orderMissing }, { status: 404 });
  if (!["PAID", "COMPLETED"].includes(parent.status)) {
    return NextResponse.json({ error: t.api.renewNotAllowed }, { status: 400 });
  }
  const subItems = parent.items.filter((i) => i.isSubscription);
  if (!subItems.length) {
    return NextResponse.json({ error: t.api.renewNoSubscription }, { status: 400 });
  }
  try {
    const order = await createOrderFromItems(
      session.userId,
      subItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      { isRenewal: true, parentOrderId: parent.id },
    );
    return NextResponse.json({ order });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "OUT_OF_STOCK") return NextResponse.json({ error: t.shop.outOfStock }, { status: 400 });
    if (code === "PRODUCT_NOT_FOUND") return NextResponse.json({ error: t.shop.productMissing }, { status: 400 });
    throw error;
  }
}
