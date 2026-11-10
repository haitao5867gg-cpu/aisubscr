import { beforeEach, expect, it, vi } from "vitest";
import { GET as exportOrders } from "@/app/api/admin/orders/export/route";
import { PATCH as patchOrder } from "@/app/api/admin/orders/[id]/route";
import { POST as createProduct } from "@/app/api/admin/products/route";
import { GET as listUsers } from "@/app/api/admin/users/route";
import { PATCH as patchUser } from "@/app/api/admin/users/[id]/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as createOrder } from "@/app/api/orders/route";
import { POST as addToCart } from "@/app/api/cart/route";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resetCookieJar } from "./cookie-jar";
import { jsonRequest, nextIp, routeContext } from "./http";

beforeEach(() => {
  resetCookieJar();
});

async function signIn(role: "USER" | "ADMIN", ip = nextIp()) {
  const email = `${role.toLowerCase()}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword("secret12"), role, name: role === "ADMIN" ? "管理员" : "会员" },
  });
  const response = await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12" } }));
  expect(response.status).toBe(200);
  return user;
}

it("refuses admin lists and mutations to anonymous callers and shoppers", async () => {
  const ip = nextIp();
  expect((await listUsers(jsonRequest("/api/admin/users", { ip, method: "GET" }))).status).toBe(401);
  expect((await exportOrders(jsonRequest("/api/admin/orders/export", { ip, method: "GET" }))).status).toBe(401);
  expect((await createProduct(jsonRequest("/api/admin/products", { ip, body: { name: "x", description: "y", priceCents: 100 } }))).status).toBe(401);

  await signIn("USER", ip);
  expect((await listUsers(jsonRequest("/api/admin/users", { ip, method: "GET" }))).status).toBe(403);
  expect((await exportOrders(jsonRequest("/api/admin/orders/export", { ip, method: "GET" }))).status).toBe(403);
  expect((await createProduct(jsonRequest("/api/admin/products", { ip, body: { name: "x", description: "y", priceCents: 100 } }))).status).toBe(403);
  const target = await prisma.user.create({
    data: { email: `target-${Date.now()}@example.com`, passwordHash: await hashPassword("secret12") },
  });
  const denied = await patchUser(
    jsonRequest(`/api/admin/users/${target.id}`, { ip, method: "PATCH", body: { disabled: true } }),
    routeContext({ id: target.id }),
  );
  expect(denied.status).toBe(403);
});

it("rejects an invalid product and stores a valid one with stock and sort order", async () => {
  const ip = nextIp();
  const admin = await signIn("ADMIN", ip);
  const invalid = await createProduct(
    jsonRequest("/api/admin/products", { ip, body: { name: "坏价格", description: "说明", priceCents: 0 } }),
  );
  expect(invalid.status).toBe(400);

  const created = await createProduct(
    jsonRequest("/api/admin/products", {
      ip,
      body: {
        name: "限量方案",
        description: "仅用于测试库存，不含账号交付。",
        priceCents: 2500,
        stock: 1,
        sortOrder: 4,
        active: true,
        imageUrl: "/images/plan.png",
      },
    }),
  );
  expect(created.status).toBe(200);
  const { product } = await created.json();
  expect(product).toMatchObject({ stock: 1, sortOrder: 4, imageUrl: "/images/plan.png" });

  const remoteImage = await createProduct(
    jsonRequest("/api/admin/products", {
      ip,
      body: { name: "外链", description: "不行", priceCents: 100, imageUrl: "https://example.com/a.png" },
    }),
  );
  expect(remoteImage.status).toBe(400);

  const audit = await prisma.auditLog.findFirst({
    where: { actorId: admin.id, action: "product.create", targetId: product.id },
  });
  expect(audit?.afterJson).toContain("限量方案");
});

it("requires a note to mark an order paid and still succeeds if the receipt email fails", async () => {
  const ip = nextIp();
  const buyer = await signIn("USER", ip);
  const product = await prisma.product.create({
    data: { name: "支付测试商品", description: "示例商品，不含账号。", priceCents: 800, active: true },
  });
  expect((await addToCart(jsonRequest("/api/cart", { ip, body: { productId: product.id, quantity: 1 } }))).status).toBe(200);
  const placed = await createOrder(jsonRequest("/api/orders", { ip, body: {} }));
  expect(placed.status).toBe(200);
  const { order } = await placed.json();

  await signIn("ADMIN", ip);
  const missingNote = await patchOrder(
    jsonRequest(`/api/admin/orders/${order.id}`, { ip, method: "PATCH", body: { status: "PAID" } }),
    routeContext({ id: order.id }),
  );
  expect(missingNote.status).toBe(400);

  const { consoleMailer } = await import("@/lib/mail/console");
  const send = vi.spyOn(consoleMailer, "send").mockRejectedValue(new Error("smtp down"));
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const paid = await patchOrder(
      jsonRequest(`/api/admin/orders/${order.id}`, {
        ip,
        method: "PATCH",
        body: { status: "PAID", note: "客户已线下付款" },
      }),
      routeContext({ id: order.id }),
    );
    expect(paid.status).toBe(200);
  } finally {
    send.mockRestore();
    logged.mockRestore();
  }

  const stored = await prisma.order.findUnique({ where: { id: order.id } });
  expect(stored?.status).toBe("PAID");
  expect(stored?.paidAt).toBeTruthy();
  const audit = await prisma.auditLog.findFirst({ where: { action: "order.status", targetId: order.id } });
  expect(audit?.note).toBe("客户已线下付款");
  expect(audit?.beforeJson).toContain("PENDING");
  expect(audit?.afterJson).toContain("PAID");

  const csv = await exportOrders(jsonRequest(`/api/admin/orders/export?email=${buyer.email}`, { ip, method: "GET" }));
  expect(csv.status).toBe(200);
  expect(csv.headers.get("content-type")).toContain("text/csv");
  const bytes = new Uint8Array(await csv.arrayBuffer());
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const text = new TextDecoder().decode(bytes);
  expect(text).toContain(order.orderNo);
  expect(text).toContain(buyer.email);
});
