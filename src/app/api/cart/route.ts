import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { inStock } from "@/lib/catalog";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  const cart = session.cart || [];
  if (!cart.length) return NextResponse.json({ items: [], totalCents: 0 });
  const products = await prisma.product.findMany({
    where: { id: { in: cart.map((c) => c.productId) }, active: true },
  });
  const map = new Map(products.map((p) => [p.id, p]));
  const items = cart
    .map((c) => {
      const p = map.get(c.productId);
      if (!p) return null;
      return { product: p, quantity: c.quantity, lineCents: p.priceCents * c.quantity };
    })
    .filter(Boolean);
  const totalCents = items.reduce((s, i) => s + (i as { lineCents: number }).lineCents, 0);
  return NextResponse.json({ items, totalCents });
}

const addSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1).default(1),
});

export async function POST(req: NextRequest) {
  const t = getDict(await getLocale());
  const session = await getSession();
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.shop.cartUpdateFailed }, { status: 400 });
  const body = parsed.data;
  const product = await prisma.product.findFirst({ where: { id: body.productId, active: true } });
  if (!product) return NextResponse.json({ error: t.shop.productMissing }, { status: 404 });
  const cart = session.cart || [];
  const existing = cart.find((c) => c.productId === body.productId);
  const nextQuantity = (existing?.quantity ?? 0) + body.quantity;
  if (!inStock(product, nextQuantity)) {
    return NextResponse.json({ error: t.shop.outOfStock }, { status: 400 });
  }
  if (existing) existing.quantity += body.quantity;
  else cart.push({ productId: body.productId, quantity: body.quantity });
  session.cart = cart;
  await session.save();
  return NextResponse.json({ ok: true, cart });
}

export async function PUT(req: NextRequest) {
  const t = getDict(await getLocale());
  const session = await getSession();
  const parsed = z
    .object({ productId: z.string(), quantity: z.number().int().min(0) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.shop.cartUpdateFailed }, { status: 400 });
  const body = parsed.data;
  let cart = session.cart || [];
  if (body.quantity === 0) cart = cart.filter((c) => c.productId !== body.productId);
  else {
    const existing = cart.find((c) => c.productId === body.productId);
    if (existing) existing.quantity = body.quantity;
  }
  session.cart = cart;
  await session.save();
  return NextResponse.json({ ok: true, cart });
}

export async function DELETE() {
  const session = await getSession();
  session.cart = [];
  await session.save();
  return NextResponse.json({ ok: true });
}
