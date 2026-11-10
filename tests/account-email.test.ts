import { beforeEach, expect, it, vi } from "vitest";
import { POST as confirmEmail } from "@/app/api/account/email/confirm/route";
import { POST as requestEmail } from "@/app/api/account/email/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as me } from "@/app/api/auth/me/route";
import { POST as register } from "@/app/api/auth/register/route";
import { consoleMailer } from "@/lib/mail/console";
import { resetCookieJar } from "./cookie-jar";
import { jsonRequest, nextIp } from "./http";

beforeEach(() => {
  resetCookieJar();
});

function codeFrom(lines: string[]) {
  const match = lines.join("\n").match(/您的验证码是 (\d{6})/);
  if (!match) throw new Error(`console mailer did not log an email-change code`);
  return match[1];
}

it("changes the email with a code and tells the old address", async () => {
  const ip = nextIp();
  const email = `mail-${Date.now()}@example.com`;
  const next = `next-${Date.now()}@example.com`;
  expect((await register(jsonRequest("/api/auth/register", { ip, body: { email, password: "secret12" } }))).status).toBe(200);

  const lines: string[] = [];
  const spy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    lines.push(args.map((part) => String(part)).join(" "));
  });
  let sentStatus = 0;
  try {
    const sent = await requestEmail(jsonRequest("/api/account/email", { ip, body: { email: next } }));
    sentStatus = sent.status;
    const limited = await requestEmail(jsonRequest("/api/account/email", { ip, body: { email: next } }));
    expect(limited.status).toBe(429);
  } finally {
    spy.mockRestore();
  }
  expect(sentStatus).toBe(200);
  const code = codeFrom(lines);

  const wrong = await confirmEmail(jsonRequest("/api/account/email/confirm", { ip, body: { email: next, code: "000000" } }));
  expect(wrong.status).toBe(400);

  const notice: string[] = [];
  const noticeSpy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    notice.push(args.map((part) => String(part)).join(" "));
  });
  try {
    const done = await confirmEmail(jsonRequest("/api/account/email/confirm", { ip, body: { email: next, code } }));
    expect(done.status).toBe(200);
    expect((await done.json()).email).toBe(next);
  } finally {
    noticeSpy.mockRestore();
  }
  expect(notice.join("\n")).toContain(email);
  expect(notice.join("\n")).toContain("aisubscr 登录邮箱已更改");

  expect((await (await me()).json()).user.email).toBe(next);
  expect((await login(jsonRequest("/api/auth/login", { ip: nextIp(), body: { email, password: "secret12" } }))).status).toBe(401);
  expect((await login(jsonRequest("/api/auth/login", { ip: nextIp(), body: { email: next, password: "secret12" } }))).status).toBe(200);
});

it("keeps the new email when the notice to the old address fails", async () => {
  const ip = nextIp();
  const email = `mail-fail-${Date.now()}@example.com`;
  const next = `moved-${Date.now()}@example.com`;
  expect((await register(jsonRequest("/api/auth/register", { ip, body: { email, password: "secret12" } }))).status).toBe(200);

  const lines: string[] = [];
  const original = consoleMailer.send.bind(consoleMailer);
  const send = vi.spyOn(consoleMailer, "send").mockImplementation(async (mail) => {
    if (mail.subject.includes("登录邮箱已更改")) throw new Error("smtp down");
    lines.push(mail.text);
    return original(mail);
  });
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await requestEmail(jsonRequest("/api/account/email", { ip, body: { email: next } }))).status).toBe(200);
    const code = codeFrom(lines);
    const done = await confirmEmail(jsonRequest("/api/account/email/confirm", { ip, body: { email: next, code } }));
    expect(done.status).toBe(200);
  } finally {
    send.mockRestore();
    logged.mockRestore();
  }
  expect((await (await me()).json()).user.email).toBe(next);
});
