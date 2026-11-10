import { beforeEach, expect, it } from "vitest";
import { POST as addToCart, PUT as updateCart } from "@/app/api/cart/route";
import { POST as createOrder } from "@/app/api/orders/route";
import { POST as register } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/db";
import { resetCookieJar } from "./cookie-jar";
import { jsonRequest, nextIp } from "./http";

beforeEach(() => {
  resetCookieJar();
});

it("rejects quantities above the line cap and updates that exceed stock", async () => {
  const ip = nextIp();
  const product = await prisma.product.create({
    data: { name: "限量商品", description: "购物车数量测试。", priceCents: 500, active: true, stock: 2 },
  });
  const email = `cart-${Date.now()}@example.com`;
  expect((await register(jsonRequest("/api/auth/register", { ip, body: { email, password: "secret12" } }))).status).toBe(200);

  const tooMany = await addToCart(jsonRequest("/api/cart", { ip, body: { productId: product.id, quantity: 100 } }));
  expect(tooMany.status).toBe(400);

  expect((await addToCart(jsonRequest("/api/cart", { ip, body: { productId: product.id, quantity: 1 } }))).status).toBe(200);
  const overStock = await updateCart(
    jsonRequest("/api/cart", { ip, method: "PUT", body: { productId: product.id, quantity: 5 } }),
  );
  expect(overStock.status).toBe(400);
  expect((await overStock.json()).error).toContain("库存");

  const zero = await createOrder(
    jsonRequest("/api/orders", { ip, body: { items: [{ productId: product.id, quantity: 0 }] } }),
  );
  expect(zero.status).toBe(400);
  expect((await prisma.order.count({ where: { userId: (await prisma.user.findUnique({ where: { email } }))!.id } }))).toBe(0);
});
