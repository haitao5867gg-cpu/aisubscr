import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as addToCart } from "@/app/api/cart/route";
import { POST as mockPay } from "@/app/api/orders/[id]/mock-pay/route";
import { POST as pay } from "@/app/api/orders/[id]/pay/route";
import { POST as createOrder } from "@/app/api/orders/route";
import { prisma } from "@/lib/db";
import type { OutboundMail } from "@/lib/mail";
import { consoleMailer } from "@/lib/mail/console";
import { resetCookieJar } from "./cookie-jar";
import { jsonRequest, nextIp, routeContext } from "./http";

const sent: OutboundMail[] = [];

beforeEach(() => {
  resetCookieJar();
  sent.length = 0;
  vi.spyOn(consoleMailer, "send").mockImplementation(async (mail: OutboundMail) => {
    sent.push(mail);
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await prisma.siteSetting.update({
    where: { id: "default" },
    data: { adminNotifyEmail: "", notifyPaidOrders: true, notifyNewTickets: true, notifyLowStock: true },
  }).catch(() => undefined);
});

async function payFor(input: { stock: number; threshold: number; quantity: number; notifyPaid: boolean; notifyLow: boolean }) {
  sent.length = 0;
  const ip = nextIp();
  await prisma.siteSetting.upsert({
    where: { id: "default" },
    update: {
      adminNotifyEmail: "ops@example.com",
      notifyPaidOrders: input.notifyPaid,
      notifyLowStock: input.notifyLow,
    },
    create: {
      id: "default",
      adminNotifyEmail: "ops@example.com",
      notifyPaidOrders: input.notifyPaid,
      notifyLowStock: input.notifyLow,
    },
  });
  const product = await prisma.product.create({
    data: {
      name: `库存邮件 ${Date.now()}-${input.stock}`,
      description: "仅用于低库存邮件测试，不含账号交付。",
      priceCents: 1000,
      active: true,
      stock: input.stock,
      lowStockThreshold: input.threshold,
    },
  });
  const email = `buyer-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  expect((await register(jsonRequest("/api/auth/register", { ip, body: { email, password: "secret12" } }))).status).toBe(200);
  expect((await addToCart(jsonRequest("/api/cart", { ip, body: { productId: product.id, quantity: input.quantity } }))).status).toBe(200);
  const created = await createOrder(jsonRequest("/api/orders", { ip, body: {} }));
  expect(created.status).toBe(200);
  const { order } = await created.json();
  const started = await pay(
    jsonRequest(`/api/orders/${order.id}/pay`, { ip, body: { method: "MOCK" } }),
    routeContext({ id: order.id }),
  );
  expect(started.status).toBe(200);
  const { payment } = await started.json();
  const paid = await mockPay(jsonRequest(payment.redirectUrl, { ip, method: "POST" }), routeContext({ id: order.id }));
  expect(paid.status).toBe(200);
  const stored = await prisma.product.findUnique({ where: { id: product.id } });
  return { product, stored, admin: sent.filter((mail) => mail.to === "ops@example.com") };
}

it("mentions a product in the paid-order email when the sale crosses the threshold", async () => {
  const { product, stored, admin } = await payFor({ stock: 6, threshold: 5, quantity: 2, notifyPaid: true, notifyLow: true });
  expect(stored?.stock).toBe(4);
  expect(admin).toHaveLength(1);
  expect(admin[0]?.subject).toContain("新支付订单");
  expect(admin[0]?.text).toContain(product.name);
  expect(admin[0]?.text).toContain("剩余 4");
  expect(admin[0]?.text).toContain("阈值 5");
});

it("leaves the paid email unchanged when stock stays above the threshold", async () => {
  const { product, admin } = await payFor({ stock: 10, threshold: 5, quantity: 1, notifyPaid: true, notifyLow: true });
  expect(admin).toHaveLength(1);
  expect(admin[0]?.text).not.toContain(product.name);
  expect(admin[0]?.text).not.toContain("阈值");
});

it("respects the paid-order and low-stock toggles", async () => {
  const hidden = await payFor({ stock: 6, threshold: 5, quantity: 2, notifyPaid: true, notifyLow: false });
  expect(hidden.admin).toHaveLength(1);
  expect(hidden.admin[0]?.text).not.toContain("阈值");

  const lowOnly = await payFor({ stock: 6, threshold: 5, quantity: 2, notifyPaid: false, notifyLow: true });
  expect(lowOnly.admin).toHaveLength(1);
  expect(lowOnly.admin[0]?.subject).toContain("低库存");
  expect(lowOnly.admin[0]?.text).toContain(lowOnly.product.name);

  const quiet = await payFor({ stock: 6, threshold: 5, quantity: 2, notifyPaid: false, notifyLow: false });
  expect(quiet.admin).toHaveLength(0);
});
