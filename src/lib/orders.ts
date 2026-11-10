import { writeAudit } from "./audit";
import { reserveCoupon } from "./coupons";
import { prisma } from "./db";
import { orderExpiresAt, resolveExpireMinutes } from "./order-expiry";

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
  opts?: { isRenewal?: boolean; parentOrderId?: string; couponCode?: string | null },
) {
  if (!items.length) throw new Error("EMPTY_CART");

  const merged = new Map<string, number>();
  for (const item of items) {
    const qty = Math.max(1, Math.floor(item.quantity) || 1);
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + qty);
  }
  const ids = [...merged.keys()];
  const couponCode = opts?.couponCode?.trim() ?? "";

  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: ids }, active: true },
    });
    if (products.length !== ids.length) throw new Error("PRODUCT_NOT_FOUND");

    const productMap = new Map(products.map((product) => [product.id, product]));
    let subtotalCents = 0;
    const orderItems = ids.map((id) => {
      const product = productMap.get(id)!;
      const quantity = merged.get(id)!;
      if (product.stock !== null && product.stock < quantity) throw new Error("OUT_OF_STOCK");
      subtotalCents += product.priceCents * quantity;
      return {
        productId: product.id,
        productName: product.name,
        unitPriceCents: product.priceCents,
        quantity,
        isSubscription: product.isSubscription,
      };
    });

    for (const item of orderItems) {
      const product = productMap.get(item.productId)!;
      if (product.stock === null) continue;
      const updated = await tx.product.updateMany({
        where: { id: product.id, active: true, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (updated.count !== 1) throw new Error("OUT_OF_STOCK");
    }

    const reserved = couponCode
      ? await reserveCoupon(tx, { code: couponCode, userId, subtotalCents })
      : null;
    const discountCents = reserved?.discountCents ?? 0;
    const settings = await tx.siteSetting.findUnique({
      where: { id: "default" },
      select: { orderExpireMinutes: true },
    });
    const expiresAt = orderExpiresAt(resolveExpireMinutes(settings?.orderExpireMinutes));

    const order = await tx.order.create({
      data: {
        orderNo: generateOrderNo(),
        userId,
        subtotalCents,
        discountCents,
        totalCents: subtotalCents - discountCents,
        couponCode: reserved?.code ?? null,
        couponId: reserved?.couponId ?? null,
        expiresAt,
        status: "PENDING",
        isRenewal: opts?.isRenewal ?? false,
        parentOrderId: opts?.parentOrderId,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    if (reserved) {
      await tx.couponRedemption.create({
        data: {
          couponId: reserved.couponId,
          orderId: order.id,
          userId,
          discountCents,
        },
      });
      const actor = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (actor) {
        await writeAudit(tx, {
          actorId: userId,
          actorEmail: actor.email,
          action: "coupon.redeem",
          targetType: "coupon",
          targetId: reserved.couponId,
          note: order.orderNo,
          after: { code: reserved.code, discountCents, orderId: order.id },
        });
      }
    }

    return order;
  });
}
