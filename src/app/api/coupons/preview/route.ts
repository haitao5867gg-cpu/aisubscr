import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { clientIp } from "@/lib/client-ip";
import { couponErrorMessage, isCouponError, quoteCoupon } from "@/lib/coupons";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const schema = z.object({
  code: z.string().trim().min(1).max(32),
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().int().positive().max(99) }))
    .max(30)
    .optional(),
});

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PREVIEWS = 30;

async function previewLimited(ip: string) {
  const bucket = `ip:${ip.slice(0, 64) || "unknown"}`;
  const now = Date.now();
  return prisma.$transaction(async (tx) => {
    await tx.authRateEvent.deleteMany({
      where: { action: "coupon-preview", createdAt: { lt: new Date(now - WINDOW_MS) } },
    });
    const count = await tx.authRateEvent.count({
      where: { action: "coupon-preview", bucket, createdAt: { gt: new Date(now - WINDOW_MS) } },
    });
    if (count >= MAX_PREVIEWS) return false;
    await tx.authRateEvent.create({ data: { action: "coupon-preview", bucket } });
    return true;
  });
}

export async function POST(req: NextRequest) {
  const t = getDict(await getLocale());
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: t.api.loginRequired }, { status: 401 });
  }
  if (!(await previewLimited(clientIp(req.headers)))) {
    return NextResponse.json({ error: t.coupon.rateLimited }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.coupon.invalid }, { status: 400 });
  const source = parsed.data.items?.length ? parsed.data.items : session.cart || [];
  if (!source.length) return NextResponse.json({ error: t.cart.empty }, { status: 400 });

  const merged = new Map<string, number>();
  for (const item of source) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }
  const products = await prisma.product.findMany({
    where: { id: { in: [...merged.keys()] }, active: true },
  });
  if (products.length !== merged.size) return NextResponse.json({ error: t.shop.productMissing }, { status: 400 });
  const subtotalCents = products.reduce((sum, product) => sum + product.priceCents * (merged.get(product.id) ?? 0), 0);

  try {
    const quote = await prisma.$transaction((tx) =>
      quoteCoupon(tx, { code: parsed.data.code, userId: session.userId!, subtotalCents }),
    );
    return NextResponse.json({ quote });
  } catch (error) {
    if (isCouponError(error)) {
      return NextResponse.json({ error: couponErrorMessage(error.message, t) ?? t.coupon.invalid }, { status: 400 });
    }
    throw error;
  }
}
