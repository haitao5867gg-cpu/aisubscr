import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/db";
import { resetCookieJar } from "./cookie-jar";
import { jsonRequest, nextIp } from "./http";

beforeEach(() => {
  resetCookieJar();
});

describe("register, login, logout", () => {
  it("creates a session, ends it, and lets the same password sign in again", async () => {
    const ip = nextIp();
    const email = `user-${Date.now()}@example.com`;
    const password = "secret12";

    const created = await register(jsonRequest("/api/auth/register", { ip, body: { email, password, name: "测试" } }));
    expect(created.status).toBe(200);
    expect((await me()).status).toBe(200);
    expect((await (await me()).json()).user.email).toBe(email);

    const ended = await logout();
    expect(ended.status).toBe(200);
    expect((await (await me()).json()).user).toBeNull();

    const again = await login(jsonRequest("/api/auth/login", { ip, body: { email, password } }));
    expect(again.status).toBe(200);
    expect((await (await me()).json()).user).toMatchObject({ email, role: "USER" });
  });

  it("rejects a second registration of the same email", async () => {
    const ip = nextIp();
    const email = `dup-${Date.now()}@example.com`;
    const first = await register(jsonRequest("/api/auth/register", { ip, body: { email, password: "secret12" } }));
    expect(first.status).toBe(200);
    await prisma.authRateEvent.deleteMany();
    const second = await register(jsonRequest("/api/auth/register", { ip: nextIp(), body: { email, password: "secret12" } }));
    expect(second.status).toBe(400);
  });
});

describe("login lockout", () => {
  it("locks the email after 5 failures", async () => {
    const ip = nextIp();
    const email = `lock-${Date.now()}@example.com`;
    const password = "secret12";
    expect((await register(jsonRequest("/api/auth/register", { ip, body: { email, password } }))).status).toBe(200);
    resetCookieJar();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "wrong-password" } }));
      expect(res.status, `attempt ${attempt}`).toBe(401);
    }

    const locked = await login(jsonRequest("/api/auth/login", { ip, body: { email, password } }));
    expect(locked.status).toBe(429);
    expect(locked.headers.get("retry-after")).toBeTruthy();
  });
});
