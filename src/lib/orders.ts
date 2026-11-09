import { prisma } from "./db";

export function generateOrderNo() {
  const now = new Date();
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  const ts =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `AS${ts}${rand}`;
}

export async function createOrderFromItems(
  userId: string,
  items: { productId: string; quantity: number }[],
  opts?: { isRenewal?: boolean; parentOrderId?: string }
) {
  if (!items.length) throw new Error("EMPTY_CART");

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, active: true },
  });
  if (products.length !== items.length) throw new Error("PRODUCT_NOT_FOUND");

  const productMap = new Map(products.map((p) => [p.id, p]));
  let totalCents = 0;
  const orderItems = items.map((i) => {
    const p = productMap.get(i.productId)!;
    const qty = Math.max(1, i.quantity);
    totalCents += p.priceCents * qty;
    return {
      productId: p.id,
      productName: p.name,
      unitPriceCents: p.priceCents,
      quantity: qty,
      isSubscription: p.isSubscription,
    };
  });

  return prisma.order.create({
    data: {
      orderNo: generateOrderNo(),
      userId,
      totalCents,
      status: "PENDING",
      isRenewal: opts?.isRenewal ?? false,
      parentOrderId: opts?.parentOrderId,
      items: { create: orderItems },
    },
    include: { items: true },
  });
}
