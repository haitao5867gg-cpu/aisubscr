import { afterEach, beforeEach, expect, it } from "vitest";
import { POST as expireRoute } from "@/app/api/internal/expire-orders/route";
import { POST as pay } from "@/app/api/orders/[id]/pay/route";
import { PATCH as setStatus } from "@/app/api/admin/orders/[id]/route";
import { POST as login } from "@/app/api/auth/login/route";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createOrderFromItems } from "@/lib/orders";
import { expireDueOrders } from "@/lib/order-expiry";
import { confirmOrderPayment } from "@/lib/payments/confirm";
import { resetCookieJar } from "./cookie-jar";
import { jsonRequest, nextIp, routeContext } from "./http";

const originalSecret = process.env.CRON_SECRET;

beforeEach(() => {
  resetCookieJar();
  process.env.CRON_SECRET = "test-cron-secret-16";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

async function buyerAndProduct(stock = 4) {
  const product = await prisma.product.create({
    data: { name: `库存 ${Date.now()}`, description: "测试", priceCents: 2000, active: true, stock },
  });
  const user = await prisma.user.create({
    data: { email: `exp-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`, passwordHash: await hashPassword("secret12") },
  });
  return { product, user };
}

it("expires an unpaid order, restores stock and a promo use, and is idempotent", async () => {
  const { product, user } = await buyerAndProduct();
  const coupon = await prisma.coupon.create({
    data: { code: `EXP${Date.now()}`, kind: "FIXED", amountCents: 200, maxUses: 2, active: true },
  });
  const order = await createOrderFromItems(user.id, [{ productId: product.id, quantity: 2 }], { couponCode: coupon.code });
  expect((await prisma.product.findUnique({ where: { id: product.id } }))?.stock).toBe(2);
  expect((await prisma.coupon.findUnique({ where: { id: coupon.id } }))?.usedCount).toBe(1);

  await prisma.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  expect(await expireDueOrders()).toMatchObject({ expired: 1 });
  expect((await prisma.order.findUnique({ where: { id: order.id } }))?.status).toBe("EXPIRED");
  expect((await prisma.product.findUnique({ where: { id: product.id } }))?.stock).toBe(4);
  expect((await prisma.coupon.findUnique({ where: { id: coupon.id } }))?.usedCount).toBe(0);
  expect((await prisma.couponRedemption.findUnique({ where: { orderId: order.id } }))?.releasedAt).toBeTruthy();

  expect(await expireDueOrders()).toMatchObject({ expired: 0 });
  expect((await prisma.product.findUnique({ where: { id: product.id } }))?.stock).toBe(4);
  expect((await prisma.coupon.findUnique({ where: { id: coupon.id } }))?.usedCount).toBe(0);
});

it("does not expire a paid order and rejects payment after the window", async () => {
  const { product, user } = await buyerAndProduct();
  const order = await createOrderFromItems(user.id, [{ productId: product.id, quantity: 1 }]);
  const paid = await confirmOrderPayment({
    orderNo: order.orderNo,
    provider: "MOCK",
    providerEventId: `evt-${order.id}`,
    amountCents: order.totalCents,
    method: "MOCK",
    success: true,
  });
  expect(paid.ok).toBe(true);
  await prisma.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  expect((await expireDueOrders()).expired).toBe(0);
  expect((await prisma.order.findUnique({ where: { id: order.id } }))?.status).toBe("PAID");
  expect((await prisma.product.findUnique({ where: { id: product.id } }))?.stock).toBe(3);

  const late = await createOrderFromItems(user.id, [{ productId: product.id, quantity: 1 }]);
  await prisma.order.update({ where: { id: late.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const rejected = await confirmOrderPayment({
    orderNo: late.orderNo,
    provider: "MOCK",
    providerEventId: `late-${late.id}`,
    amountCents: late.totalCents,
    method: "MOCK",
    success: true,
  });
  expect(rejected).toMatchObject({ ok: false, reason: "STATE" });
  expect((await prisma.order.findUnique({ where: { id: late.id } }))?.status).toBe("EXPIRED");
  expect((await prisma.product.findUnique({ where: { id: product.id } }))?.stock).toBe(3);
});

it("releases stock when an admin cancels an unpaid order", async () => {
  const ip = nextIp();
  const { product, user } = await buyerAndProduct(2);
  const order = await createOrderFromItems(user.id, [{ productId: product.id, quantity: 1 }]);
  const adminEmail = `admin-exp-${Date.now()}@example.com`;
  await prisma.user.create({
    data: { email: adminEmail, passwordHash: await hashPassword("secret12"), role: "ADMIN", name: "管理员" },
  });
  expect((await login(jsonRequest("/api/auth/login", { ip, body: { email: adminEmail, password: "secret12" } }))).status).toBe(200);
  const cancelled = await setStatus(
    jsonRequest(`/api/admin/orders/${order.id}`, { ip, method: "PATCH", body: { status: "CANCELLED", note: "顾客要求取消" } }),
    routeContext({ id: order.id }),
  );
  expect(cancelled.status).toBe(200);
  expect((await prisma.product.findUnique({ where: { id: product.id } }))?.stock).toBe(2);
});

it("hides the cron route without a secret and expires due orders when authorized", async () => {
  const { product, user } = await buyerAndProduct();
  const order = await createOrderFromItems(user.id, [{ productId: product.id, quantity: 1 }]);
  await prisma.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() - 5000) } });

  delete process.env.CRON_SECRET;
  expect((await expireRoute(jsonRequest("/api/internal/expire-orders", { method: "POST" }))).status).toBe(404);

  process.env.CRON_SECRET = "test-cron-secret-16";
  expect((await expireRoute(jsonRequest("/api/internal/expire-orders", { method: "POST" }))).status).toBe(401);
  const ok = await expireRoute(
    jsonRequest("/api/internal/expire-orders", {
      method: "POST",
      body: {},
    }),
  );
  // jsonRequest does not set Authorization. Build a request with the header.
  expect(ok.status).toBe(401);

  const headers = new Headers();
  headers.set("authorization", "Bearer test-cron-secret-16");
  headers.set("content-type", "application/json");
  const { NextRequest } = await import("next/server");
  const authed = await expireRoute(new NextRequest("http://127.0.0.1/api/internal/expire-orders", { method: "POST", headers }));
  expect(authed.status).toBe(200);
  expect(await authed.json()).toMatchObject({ ok: true, expired: 1 });
  const again = await expireRoute(new NextRequest("http://127.0.0.1/api/internal/expire-orders", { method: "POST", headers }));
  expect(await again.json()).toMatchObject({ ok: true, expired: 0 });
  expect((await prisma.product.findUnique({ where: { id: product.id } }))?.stock).toBe(4);
});

it("refuses to start payment after the order has expired", async () => {
  const ip = nextIp();
  const { product, user } = await buyerAndProduct();
  const order = await createOrderFromItems(user.id, [{ productId: product.id, quantity: 1 }]);
  await prisma.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  expect((await login(jsonRequest("/api/auth/login", { ip, body: { email: user.email, password: "secret12" } }))).status).toBe(200);
  const started = await pay(
    jsonRequest(`/api/orders/${order.id}/pay`, { ip, body: { method: "MOCK" } }),
    routeContext({ id: order.id }),
  );
  expect(started.status).toBe(400);
  expect((await prisma.order.findUnique({ where: { id: order.id } }))?.status).toBe("EXPIRED");
});
