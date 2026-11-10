import { beforeEach, expect, it } from "vitest";
import { POST as addToCart } from "@/app/api/cart/route";
import { POST as mockPay } from "@/app/api/orders/[id]/mock-pay/route";
import { POST as pay } from "@/app/api/orders/[id]/pay/route";
import { POST as createOrder } from "@/app/api/orders/route";
import { POST as register } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/db";
import { claimPayableOrder } from "@/lib/payments/claim";
import { confirmOrderPayment } from "@/lib/payments/confirm";
import { resetCookieJar } from "./cookie-jar";
import { jsonRequest, nextIp, routeContext } from "./http";

beforeEach(() => {
  resetCookieJar();
});

it("checks out a cart with mock pay and ignores a repeated confirmation", async () => {
  const ip = nextIp();
  const product = await prisma.product.create({
    data: {
      name: "测试商品",
      description: "仅用于自动化测试的示例商品，不含账号交付。",
      priceCents: 1500,
      active: true,
    },
  });

  const cart = await addToCart(jsonRequest("/api/cart", { ip, body: { productId: product.id, quantity: 2 } }));
  expect(cart.status).toBe(200);

  const email = `buyer-${Date.now()}@example.com`;
  const signedUp = await register(jsonRequest("/api/auth/register", { ip, body: { email, password: "secret12" } }));
  expect(signedUp.status).toBe(200);

  const created = await createOrder(jsonRequest("/api/orders", { ip, body: {} }));
  expect(created.status).toBe(200);
  const { order } = await created.json();
  expect(order).toMatchObject({ status: "PENDING", totalCents: 3000 });

  const started = await pay(
    jsonRequest(`/api/orders/${order.id}/pay`, { ip, body: { method: "MOCK" } }),
    routeContext({ id: order.id }),
  );
  expect(started.status).toBe(200);
  const { payment } = await started.json();
  expect(payment.mocked).toBe(true);
  expect(payment.redirectUrl).toContain(`/api/orders/${order.id}/mock-pay`);

  const paid = await mockPay(jsonRequest(payment.redirectUrl, { ip, method: "POST" }), routeContext({ id: order.id }));
  expect(paid.status).toBe(200);
  expect((await paid.json()).duplicate).toBe(false);

  const stored = await prisma.order.findUnique({ where: { id: order.id } });
  expect(stored?.status).toBe("PAID");
  expect(stored?.paymentProvider).toBe("MOCK");
  const paidAt = stored?.paidAt?.toISOString();

  const repeat = await mockPay(jsonRequest(payment.redirectUrl, { ip, method: "POST" }), routeContext({ id: order.id }));
  expect(repeat.status).toBe(200);
  expect((await repeat.json()).duplicate).toBe(true);
  expect(await prisma.paymentNotice.count({ where: { orderNo: order.orderNo } })).toBe(1);

  const secondEvent = await confirmOrderPayment({
    orderNo: order.orderNo,
    provider: "MOCK",
    providerEventId: "evt-other",
    amountCents: order.totalCents,
    method: "MOCK",
    success: true,
  });
  expect(secondEvent).toMatchObject({ ok: true, applied: false, duplicate: true, status: "PAID" });
  const after = await prisma.order.findUnique({ where: { id: order.id } });
  expect(after?.status).toBe("PAID");
  expect(after?.paidAt?.toISOString()).toBe(paidAt);
});

it("does not reopen a cancelled order when payment starts", async () => {
  const ip = nextIp();
  const product = await prisma.product.create({
    data: { name: "取消商品", description: "仅用于支付状态测试。", priceCents: 800, active: true, stock: 2 },
  });
  const email = `cancel-${Date.now()}@example.com`;
  expect((await register(jsonRequest("/api/auth/register", { ip, body: { email, password: "secret12" } }))).status).toBe(200);
  const created = await createOrder(
    jsonRequest("/api/orders", { ip, body: { items: [{ productId: product.id, quantity: 1 }] } }),
  );
  expect(created.status).toBe(200);
  const { order } = await created.json();
  await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
  const started = await pay(
    jsonRequest(`/api/orders/${order.id}/pay`, { ip, body: { method: "MOCK" } }),
    routeContext({ id: order.id }),
  );
  expect(started.status).toBe(400);
  expect((await prisma.order.findUnique({ where: { id: order.id } }))?.status).toBe("CANCELLED");
  const claimed = await claimPayableOrder(order.id, { paymentMethod: "MOCK", paymentProvider: "MOCK" });
  expect(claimed.count).toBe(0);
  expect((await prisma.order.findUnique({ where: { id: order.id } }))?.status).toBe("CANCELLED");
  expect((await prisma.product.findUnique({ where: { id: product.id } }))?.stock).toBe(1);
});

it("refuses mock completion after a live provider was selected", async () => {
  const ip = nextIp();
  const product = await prisma.product.create({
    data: { name: "渠道商品", description: "仅用于支付渠道测试。", priceCents: 800, active: true },
  });
  const email = `live-${Date.now()}@example.com`;
  expect((await register(jsonRequest("/api/auth/register", { ip, body: { email, password: "secret12" } }))).status).toBe(200);
  const created = await createOrder(
    jsonRequest("/api/orders", { ip, body: { items: [{ productId: product.id, quantity: 1 }] } }),
  );
  const { order } = await created.json();
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PAYING", paymentProvider: "WECHAT", paymentMethod: "WECHAT" },
  });
  const paid = await mockPay(
    jsonRequest(`/api/orders/${order.id}/mock-pay?method=WECHAT`, { ip, method: "POST" }),
    routeContext({ id: order.id }),
  );
  expect(paid.status).toBe(400);
  expect((await prisma.order.findUnique({ where: { id: order.id } }))?.status).toBe("PAYING");
});
