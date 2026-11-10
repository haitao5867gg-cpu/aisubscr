import { beforeEach, expect, it } from "vitest";
import { GET as adminOrders } from "@/app/api/admin/orders/route";
import { POST as login } from "@/app/api/auth/login/route";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resetCookieJar } from "./cookie-jar";
import { jsonRequest, nextIp } from "./http";

beforeEach(() => {
  resetCookieJar();
});

it("returns 401 for anonymous callers and 403 for a signed-in non-admin", async () => {
  const ip = nextIp();
  expect((await adminOrders(jsonRequest("/api/admin/orders", { ip, method: "GET" }))).status).toBe(401);

  const email = `member-${Date.now()}@example.com`;
  await prisma.user.create({
    data: { email, passwordHash: await hashPassword("secret12"), role: "USER" },
  });
  expect((await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12" } }))).status).toBe(200);
  expect((await adminOrders(jsonRequest("/api/admin/orders", { ip, method: "GET" }))).status).toBe(403);

  const adminEmail = `admin-${Date.now()}@example.com`;
  await prisma.user.create({
    data: { email: adminEmail, passwordHash: await hashPassword("secret12"), role: "ADMIN", name: "管理员" },
  });
  expect((await login(jsonRequest("/api/auth/login", { ip, body: { email: adminEmail, password: "secret12" } }))).status).toBe(200);
  const allowed = await adminOrders(jsonRequest("/api/admin/orders", { ip, method: "GET" }));
  expect(allowed.status).toBe(200);
  expect(await allowed.json()).toHaveProperty("orders");
});
