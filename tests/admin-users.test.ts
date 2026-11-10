import { beforeEach, expect, it, vi } from "vitest";
import { POST as resetPassword } from "@/app/api/admin/users/[id]/reset-password/route";
import { PATCH as patchUser } from "@/app/api/admin/users/[id]/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resetCookieJar, sessionSeal, setSessionSeal } from "./cookie-jar";
import { jsonRequest, nextIp, routeContext } from "./http";

beforeEach(() => {
  resetCookieJar();
});

it("disables a user, drops the existing session, and lets an enabled account log in again", async () => {
  const userIp = nextIp();
  const adminIp = nextIp();
  const email = `disabled-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword("secret12"), name: "停用测试" },
  });
  expect((await login(jsonRequest("/api/auth/login", { ip: userIp, body: { email, password: "secret12" } }))).status).toBe(200);
  const seal = sessionSeal();
  expect(seal).toBeTruthy();

  const admin = await prisma.user.create({
    data: {
      email: `admin-${Date.now()}@example.com`,
      passwordHash: await hashPassword("secret12"),
      role: "ADMIN",
      name: "管理员",
    },
  });
  expect((await login(jsonRequest("/api/auth/login", { ip: adminIp, body: { email: admin.email, password: "secret12" } }))).status).toBe(200);

  const self = await patchUser(
    jsonRequest(`/api/admin/users/${admin.id}`, { ip: adminIp, method: "PATCH", body: { disabled: true } }),
    routeContext({ id: admin.id }),
  );
  expect(self.status).toBe(400);

  const disabled = await patchUser(
    jsonRequest(`/api/admin/users/${user.id}`, { ip: adminIp, method: "PATCH", body: { disabled: true } }),
    routeContext({ id: user.id }),
  );
  expect(disabled.status).toBe(200);

  setSessionSeal(seal);
  expect((await (await me()).json()).user).toBeNull();
  const blocked = await login(jsonRequest("/api/auth/login", { ip: userIp, body: { email, password: "secret12" } }));
  expect(blocked.status).toBe(403);
  expect((await blocked.json()).error).toContain("停用");

  expect((await login(jsonRequest("/api/auth/login", { ip: adminIp, body: { email: admin.email, password: "secret12" } }))).status).toBe(200);
  const enabled = await patchUser(
    jsonRequest(`/api/admin/users/${user.id}`, { ip: adminIp, method: "PATCH", body: { disabled: false } }),
    routeContext({ id: user.id }),
  );
  expect(enabled.status).toBe(200);

  setSessionSeal(seal);
  expect((await (await me()).json()).user).toBeNull();
  const again = await login(jsonRequest("/api/auth/login", { ip: nextIp(), body: { email, password: "secret12" } }));
  expect(again.status).toBe(200);

  const audit = await prisma.auditLog.findMany({ where: { targetId: user.id }, orderBy: { createdAt: "asc" } });
  expect(audit.map((row) => row.action)).toEqual(["user.disable", "user.enable"]);
  expect(audit[0]?.beforeJson).toContain('"disabled":false');
  expect(audit[0]?.afterJson).toContain('"disabled":true');
});

it("emails a password reset without putting the code in the audit log", async () => {
  const ip = nextIp();
  const email = `reset-admin-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword("secret12") },
  });
  const admin = await prisma.user.create({
    data: { email: `ops-${Date.now()}@example.com`, passwordHash: await hashPassword("secret12"), role: "ADMIN" },
  });
  expect((await login(jsonRequest("/api/auth/login", { ip, body: { email: admin.email, password: "secret12" } }))).status).toBe(200);

  const lines: string[] = [];
  const spy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    lines.push(args.map((part) => String(part)).join(" "));
  });
  try {
    const sent = await resetPassword(
      jsonRequest(`/api/admin/users/${user.id}/reset-password`, { ip, method: "POST" }),
      routeContext({ id: user.id }),
    );
    expect(sent.status).toBe(200);
  } finally {
    spy.mockRestore();
  }
  const code = lines.join("\n").match(/您的验证码是 (\d{6})/)?.[1];
  expect(code).toMatch(/^\d{6}$/);
  const audit = await prisma.auditLog.findFirst({ where: { action: "user.password_reset", targetId: user.id } });
  expect(audit?.afterJson).toContain("sent");
  expect(audit?.afterJson).not.toContain(code);
});
