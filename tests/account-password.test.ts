import { beforeEach, expect, it, vi } from "vitest";
import { POST as changePassword } from "@/app/api/account/password/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { consoleMailer } from "@/lib/mail/console";
import { prisma } from "@/lib/db";
import { resetCookieJar, sessionSeal, setSessionSeal } from "./cookie-jar";
import { jsonRequest, nextIp } from "./http";

beforeEach(() => {
  resetCookieJar();
});

it("changes the password, keeps this session, and logs out the previous seal", async () => {
  const ip = nextIp();
  const email = `pw-${Date.now()}@example.com`;
  expect((await register(jsonRequest("/api/auth/register", { ip, body: { email, password: "secret12" } }))).status).toBe(200);
  const previous = sessionSeal();
  const before = await prisma.user.findUnique({ where: { email } });

  const wrong = await changePassword(
    jsonRequest("/api/account/password", { ip, body: { currentPassword: "nope", newPassword: "secret13" } }),
  );
  expect(wrong.status).toBe(400);

  const lines: string[] = [];
  const spy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    lines.push(args.map((part) => String(part)).join(" "));
  });
  try {
    const changed = await changePassword(
      jsonRequest("/api/account/password", { ip, body: { currentPassword: "secret12", newPassword: "secret13" } }),
    );
    expect(changed.status).toBe(200);
  } finally {
    spy.mockRestore();
  }
  expect(lines.join("\n")).toContain("aisubscr 密码已修改");
  expect(lines.join("\n")).toContain("<!DOCTYPE html");

  expect((await (await me()).json()).user.email).toBe(email);
  const after = await prisma.user.findUnique({ where: { email } });
  expect(after?.sessionVersion).toBe((before?.sessionVersion ?? 0) + 1);

  setSessionSeal(previous);
  expect((await (await me()).json()).user).toBeNull();

  expect((await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12" } }))).status).toBe(401);
  expect((await login(jsonRequest("/api/auth/login", { ip: nextIp(), body: { email, password: "secret13" } }))).status).toBe(200);
});

it("still updates the password when the notice cannot be sent", async () => {
  const ip = nextIp();
  const email = `pw-mail-${Date.now()}@example.com`;
  expect((await register(jsonRequest("/api/auth/register", { ip, body: { email, password: "secret12" } }))).status).toBe(200);
  const send = vi.spyOn(consoleMailer, "send").mockRejectedValue(new Error("smtp down"));
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const changed = await changePassword(
      jsonRequest("/api/account/password", { ip, body: { currentPassword: "secret12", newPassword: "secret13" } }),
    );
    expect(changed.status).toBe(200);
  } finally {
    send.mockRestore();
    logged.mockRestore();
  }
  expect((await login(jsonRequest("/api/auth/login", { ip: nextIp(), body: { email, password: "secret13" } }))).status).toBe(200);
});
