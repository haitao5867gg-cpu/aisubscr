import { beforeEach, expect, it } from "vitest";
import { DELETE as deleteCoupon, PATCH as updateCoupon } from "@/app/api/admin/coupons/[id]/route";
import { GET as listCoupons, POST as createCoupon } from "@/app/api/admin/coupons/route";
import { POST as previewCoupon } from "@/app/api/coupons/preview/route";
import { POST as login } from "@/app/api/auth/login/route";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createOrderFromItems } from "@/lib/orders";
import { resetCookieJar } from "./cookie-jar";
import { jsonRequest, nextIp, routeContext } from "./http";

beforeEach(() => {
  resetCookieJar();
});

async function user(role: "USER" | "ADMIN") {
  const email = `${role.toLowerCase()}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = "secret12";
  await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), role, name: role === "ADMIN" ? "管理员" : "买家" },
  });
  return { email, password };
}

it("rejects coupon admin routes for anonymous and non-admin callers", async () => {
  const ip = nextIp();
  expect((await listCoupons()).status).toBe(401);

  const member = await user("USER");
  expect((await login(jsonRequest("/api/auth/login", { ip, body: member }))).status).toBe(200);
  expect((await listCoupons()).status).toBe(403);
  expect((await createCoupon(jsonRequest("/api/admin/coupons", { ip, body: { code: "NOPE", kind: "PERCENT", percentOff: 10 } }))).status).toBe(403);
});

it("creates a coupon, applies it once, and blocks the next order at the cap", async () => {
  const ip = nextIp();
  const admin = await user("ADMIN");
  expect((await login(jsonRequest("/api/auth/login", { ip, body: admin }))).status).toBe(200);
  const created = await createCoupon(
    jsonRequest("/api/admin/coupons", {
      ip,
      body: { code: "save10", kind: "PERCENT", percentOff: 10, minOrderCents: 0, maxUses: 1, maxUsesPerUser: 1, active: true },
    }),
  );
  expect(created.status).toBe(200);
  const { coupon } = await created.json();
  expect(coupon.code).toBe("SAVE10");
  const audit = await prisma.auditLog.findFirst({ where: { action: "coupon.create", targetId: coupon.id } });
  expect(audit?.actorEmail).toBe(admin.email);

  const product = await prisma.product.create({
    data: { name: "优惠测试", description: "测试", priceCents: 10_000, active: true, stock: 5 },
  });
  const buyer = await user("USER");
  expect((await login(jsonRequest("/api/auth/login", { ip, body: buyer }))).status).toBe(200);
  const buyerRow = await prisma.user.findUniqueOrThrow({ where: { email: buyer.email } });

  const preview = await previewCoupon(jsonRequest("/api/coupons/preview", { ip, body: { code: "save10", items: [{ productId: product.id, quantity: 1 }] } }));
  expect(preview.status).toBe(200);
  expect((await preview.json()).quote).toMatchObject({ discountCents: 1000, totalCents: 9000 });
  expect((await prisma.coupon.findUnique({ where: { id: coupon.id } }))?.usedCount).toBe(0);

  const order = await createOrderFromItems(buyerRow.id, [{ productId: product.id, quantity: 1 }], { couponCode: "save10" });
  expect(order).toMatchObject({ subtotalCents: 10_000, discountCents: 1000, totalCents: 9000, couponCode: "SAVE10", status: "PENDING" });
  expect((await prisma.coupon.findUnique({ where: { id: coupon.id } }))?.usedCount).toBe(1);
  expect(await prisma.auditLog.count({ where: { action: "coupon.redeem", targetId: coupon.id } })).toBe(1);

  await expect(createOrderFromItems(buyerRow.id, [{ productId: product.id, quantity: 1 }], { couponCode: "SAVE10" })).rejects.toThrow("COUPON_LIMIT");
  expect((await prisma.coupon.findUnique({ where: { id: coupon.id } }))?.usedCount).toBe(1);
  expect((await prisma.product.findUnique({ where: { id: product.id } }))?.stock).toBe(4);

  expect((await login(jsonRequest("/api/auth/login", { ip, body: admin }))).status).toBe(200);
  const removed = await deleteCoupon(jsonRequest(`/api/admin/coupons/${coupon.id}`, { ip, method: "DELETE" }), routeContext({ id: coupon.id }));
  expect(removed.status).toBe(409);
  const turnedOff = await updateCoupon(
    jsonRequest(`/api/admin/coupons/${coupon.id}`, {
      ip,
      method: "PATCH",
      body: { code: "SAVE10", kind: "PERCENT", percentOff: 10, maxUses: 1, maxUsesPerUser: 1, active: false },
    }),
    routeContext({ id: coupon.id }),
  );
  expect(turnedOff.status).toBe(200);
  expect(await prisma.auditLog.count({ where: { action: "coupon.update", targetId: coupon.id } })).toBe(1);
});

it("enforces a fixed amount, a minimum, and a per-person cap", async () => {
  const product = await prisma.product.create({
    data: { name: "定额优惠", description: "测试", priceCents: 3000, active: true, stock: 8 },
  });
  const buyer = await prisma.user.create({
    data: { email: `fixed-${Date.now()}@example.com`, passwordHash: await hashPassword("secret12") },
  });
  const other = await prisma.user.create({
    data: { email: `other-${Date.now()}@example.com`, passwordHash: await hashPassword("secret12") },
  });
  await prisma.coupon.create({
    data: { code: "CUT5", kind: "FIXED", amountCents: 500, minOrderCents: 2000, maxUsesPerUser: 1, active: true },
  });

  await expect(createOrderFromItems(buyer.id, [{ productId: product.id, quantity: 1 }], { couponCode: "cut5" })).resolves.toMatchObject({
    discountCents: 500,
    totalCents: 2500,
    couponCode: "CUT5",
  });
  await expect(createOrderFromItems(buyer.id, [{ productId: product.id, quantity: 1 }], { couponCode: "CUT5" })).rejects.toThrow("COUPON_USER_LIMIT");
  await expect(createOrderFromItems(other.id, [{ productId: product.id, quantity: 1 }], { couponCode: "CUT5" })).resolves.toMatchObject({
    totalCents: 2500,
  });

  await prisma.coupon.create({
    data: { code: "BIGMIN", kind: "FIXED", amountCents: 100, minOrderCents: 10_000, active: true },
  });
  await expect(createOrderFromItems(other.id, [{ productId: product.id, quantity: 1 }], { couponCode: "BIGMIN" })).rejects.toThrow("COUPON_MIN_ORDER");
});

it("lets only one of two concurrent checkouts take the last use", async () => {
  const product = await prisma.product.create({
    data: { name: "并发优惠", description: "测试", priceCents: 1500, active: true, stock: 5 },
  });
  const buyer = await prisma.user.create({
    data: { email: `race-${Date.now()}@example.com`, passwordHash: await hashPassword("secret12") },
  });
  await prisma.coupon.create({
    data: { code: "ONCE", kind: "PERCENT", percentOff: 50, maxUses: 1, active: true },
  });
  const results = await Promise.allSettled([
    createOrderFromItems(buyer.id, [{ productId: product.id, quantity: 1 }], { couponCode: "ONCE" }),
    createOrderFromItems(buyer.id, [{ productId: product.id, quantity: 1 }], { couponCode: "ONCE" }),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  expect(fulfilled).toHaveLength(1);
  expect((await prisma.coupon.findUnique({ where: { code: "ONCE" } }))?.usedCount).toBe(1);
  expect(await prisma.order.count({ where: { userId: buyer.id, couponCode: "ONCE" } })).toBe(1);
  expect((await prisma.product.findUnique({ where: { id: product.id } }))?.stock).toBe(4);
});
