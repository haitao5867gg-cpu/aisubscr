import { beforeEach, expect, it, vi } from "vitest";
import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { resetCookieJar, sessionSeal, setSessionSeal } from "./cookie-jar";
import { jsonRequest, nextIp } from "./http";

beforeEach(() => {
  resetCookieJar();
});

function resetCode(lines: string[]) {
  const text = lines.join("\n");
  const match = text.match(/您的验证码是 (\d{6})/);
  if (!match) throw new Error(`console mailer did not log a reset code: ${text.slice(0, 400)}`);
  return match[1];
}

it("sends an unregistered email toward registration", async () => {
  const res = await forgot(
    jsonRequest("/api/auth/forgot-password", { ip: nextIp(), body: { email: "Missing@Example.com" } }),
  );
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    status: "not_registered",
    email: "missing@example.com",
  });
});

it("resets a password from the console mailer and drops the old session", async () => {
  const ip = nextIp();
  const email = `reset-${Date.now()}@example.com`;
  const password = "oldpass1";
  expect((await register(jsonRequest("/api/auth/register", { ip, body: { email, password } }))).status).toBe(200);
  const seal = sessionSeal();
  expect(seal).toBeTruthy();

  const lines: string[] = [];
  const spy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    lines.push(args.map((part) => String(part)).join(" "));
  });
  try {
    const sent = await forgot(jsonRequest("/api/auth/forgot-password", { ip, body: { email } }));
    expect(sent.status).toBe(200);
    expect((await sent.json()).status).toBe("sent");
  } finally {
    spy.mockRestore();
  }
  const code = resetCode(lines);
  expect(lines.join("\n")).toContain('"provider":"console"');

  const done = await reset(jsonRequest("/api/auth/reset-password", { ip, body: { email, code, password: "newpass1" } }));
  expect(done.status).toBe(200);

  setSessionSeal(seal);
  expect((await (await me()).json()).user).toBeNull();

  const oldLogin = await login(jsonRequest("/api/auth/login", { ip, body: { email, password } }));
  expect(oldLogin.status).toBe(401);
  const newLogin = await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "newpass1" } }));
  expect(newLogin.status).toBe(200);
  expect((await (await me()).json()).user.email).toBe(email);
});
