import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
  const session = await getSession();
  const body = addSchema.parse(await req.json());
  const product = await prisma.product.findFirst({ where: { id: body.productId, active: true } });
  if (!product) return NextResponse.json({ error: "商品不存在" }, { status: 404 });
  const cart = session.cart || [];
  const existing = cart.find((c) => c.productId === body.productId);
  if (existing) existing.quantity += body.quantity;
  else cart.push({ productId: body.productId, quantity: body.quantity });
  session.cart = cart;
  await session.save();
  return NextResponse.json({ ok: true, cart });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  const body = z
    .object({ productId: z.string(), quantity: z.number().int().min(0) })
    .parse(await req.json());
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
