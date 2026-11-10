import { rm } from "node:fs/promises";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { NextRequest } from "next/server";
import { PATCH as updateTicket } from "@/app/api/admin/tickets/[id]/route";
import { POST as adminReply } from "@/app/api/admin/tickets/[id]/reply/route";
import { GET as adminTickets } from "@/app/api/admin/tickets/route";
import { GET as publicOrder } from "@/app/api/public/orders/[token]/route";
import { POST as upload } from "@/app/api/uploads/route";
import { GET as readTicket } from "@/app/api/tickets/[id]/route";
import { POST as replyTicket } from "@/app/api/tickets/[id]/reply/route";
import { POST as createTicket } from "@/app/api/tickets/route";
import { POST as login } from "@/app/api/auth/login/route";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { OutboundMail } from "@/lib/mail";
import { consoleMailer } from "@/lib/mail/console";
import { confirmOrderPayment } from "@/lib/payments/confirm";
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
    data: { adminNotifyEmail: "", notifyNewTickets: true, notifyPaidOrders: true },
  }).catch(() => undefined);
});

afterAll(async () => {
  await rm("public/uploads/tickets", { recursive: true, force: true });
});

async function signIn(role: "USER" | "ADMIN", ip = nextIp()) {
  const email = `${role.toLowerCase()}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword("secret12"), role, name: role === "ADMIN" ? "管理员" : "用户" },
  });
  expect((await login(jsonRequest("/api/auth/login", { ip, body: { email, password: "secret12" } }))).status).toBe(200);
  return { user, email, ip };
}

async function openTicket(ip: string, body: Record<string, unknown> = {}) {
  return createTicket(jsonRequest("/api/tickets", {
    ip,
    body: { subject: "打不开页面", category: "technical", body: "首页是空白的", ...body },
  }));
}

it("rejects anonymous ticket reads and hides one customer's ticket from another", async () => {
  const ip = nextIp();
  expect((await createTicket(jsonRequest("/api/tickets", { ip, body: { subject: "你好", category: "other", body: "内容" } }))).status).toBe(401);

  await signIn("USER", ip);
  const created = await openTicket(ip);
  expect(created.status).toBe(200);
  const { ticket } = await created.json();

  const otherIp = nextIp();
  await signIn("USER", otherIp);
  expect((await readTicket(jsonRequest(`/api/tickets/${ticket.id}`, { ip: otherIp, method: "GET" }), routeContext({ id: ticket.id }))).status).toBe(404);
  const list = await (await import("@/app/api/tickets/route")).GET();
  const listed = await list.json();
  expect(JSON.stringify(listed)).not.toContain(ticket.id);
  expect((await replyTicket(
    jsonRequest(`/api/tickets/${ticket.id}/reply`, { ip: otherIp, body: { body: "偷看" } }),
    routeContext({ id: ticket.id }),
  )).status).toBe(404);
  expect((await adminTickets(jsonRequest("/api/admin/tickets", { ip: otherIp, method: "GET" }))).status).toBe(403);

  await signIn("ADMIN", ip);
  const allowed = await readTicket(jsonRequest(`/api/tickets/${ticket.id}`, { ip, method: "GET" }), routeContext({ id: ticket.id }));
  expect(allowed.status).toBe(404);
  const inbox = await adminTickets(jsonRequest("/api/admin/tickets?status=OPEN", { ip, method: "GET" }));
  expect(inbox.status).toBe(200);
  expect(JSON.stringify(await inbox.json())).toContain(ticket.id);
});

it("keeps internal notes off the customer ticket and the public order", async () => {
  const ip = nextIp();
  const owner = await signIn("USER", ip);
  const order = await prisma.order.create({
    data: { orderNo: `T${Date.now()}`, userId: owner.user.id, status: "PAID", totalCents: 1000, subtotalCents: 1000 },
  });
  const created = await openTicket(ip, { orderId: order.id, category: "order", subject: "订单问题" });
  expect(created.status).toBe(200);
  const { ticket } = await created.json();

  const stranger = await prisma.order.create({
    data: { orderNo: `X${Date.now()}`, userId: (await signIn("USER", nextIp())).user.id, status: "PAID", totalCents: 100, subtotalCents: 100 },
  });
  await signIn("USER", ip);
  // signIn replaced the session with a new user. Sign the owner back in.
  expect((await login(jsonRequest("/api/auth/login", { ip, body: { email: owner.email, password: "secret12" } }))).status).toBe(200);
  expect((await openTicket(ip, { orderId: stranger.id })).status).toBe(404);

  const adminIp = nextIp();
  await signIn("ADMIN", adminIp);
  const note = "INTERNAL-NOTE-SECRET";
  const noted = await adminReply(
    jsonRequest(`/api/admin/tickets/${ticket.id}/reply`, { ip: adminIp, body: { body: note, internal: true } }),
    routeContext({ id: ticket.id }),
  );
  expect(noted.status).toBe(200);
  expect(sent.find((mail) => mail.text.includes(note))).toBeUndefined();

  const replied = await adminReply(
    jsonRequest(`/api/admin/tickets/${ticket.id}/reply`, { ip: adminIp, body: { body: "请再试一次" } }),
    routeContext({ id: ticket.id }),
  );
  expect(replied.status).toBe(200);
  expect(sent.some((mail) => mail.to === owner.email && mail.text.includes("请再试一次"))).toBe(true);

  expect((await login(jsonRequest("/api/auth/login", { ip, body: { email: owner.email, password: "secret12" } }))).status).toBe(200);
  const seen = await readTicket(jsonRequest(`/api/tickets/${ticket.id}`, { ip, method: "GET" }), routeContext({ id: ticket.id }));
  const customerJson = JSON.stringify(await seen.json());
  expect(customerJson).not.toContain(note);
  expect(customerJson).toContain("请再试一次");
  expect(customerJson).toContain("WAITING_CUSTOMER");

  const shared = await publicOrder(jsonRequest(`/api/public/orders/${order.publicToken}`, { method: "GET" }), routeContext({ token: order.publicToken }));
  expect(JSON.stringify(await shared.json())).not.toContain(note);

  const audits = await prisma.auditLog.findMany({ where: { targetId: ticket.id } });
  expect(audits.map((row) => row.action).sort()).toEqual(["ticket.note", "ticket.reply"]);
});

it("assigns a ticket, changes status, and writes both to the audit log", async () => {
  const ip = nextIp();
  const owner = await signIn("USER", ip);
  const created = await openTicket(ip, { subject: "想改邮箱" , category: "account" });
  const { ticket } = await created.json();
  const admin = await signIn("ADMIN", ip);
  const saved = await updateTicket(
    jsonRequest(`/api/admin/tickets/${ticket.id}`, { ip, method: "PATCH", body: { assigneeId: admin.user.id, status: "RESOLVED" } }),
    routeContext({ id: ticket.id }),
  );
  expect(saved.status).toBe(200);
  expect(await saved.json()).toMatchObject({ ticket: { status: "RESOLVED", assigneeId: admin.user.id } });
  const actions = (await prisma.auditLog.findMany({ where: { targetId: ticket.id } })).map((row) => row.action).sort();
  expect(actions).toEqual(["ticket.assign", "ticket.status"]);

  const stranger = await signIn("USER", nextIp());
  const denied = await updateTicket(
    jsonRequest(`/api/admin/tickets/${ticket.id}`, { ip: stranger.ip, method: "PATCH", body: { assigneeId: stranger.user.id } }),
    routeContext({ id: ticket.id }),
  );
  expect(denied.status).toBe(403);
  expect(owner.user.id).not.toBe(stranger.user.id);
});

it("emails the admin address for a new ticket and a paid order, and still saves when mail fails", async () => {
  await prisma.siteSetting.upsert({
    where: { id: "default" },
    update: { adminNotifyEmail: "ops@example.com", notifyNewTickets: true, notifyPaidOrders: true },
    create: { id: "default", adminNotifyEmail: "ops@example.com" },
  });
  const ip = nextIp();
  const owner = await signIn("USER", ip);
  const created = await openTicket(ip, { subject: "新工单通知" });
  expect(created.status).toBe(200);
  expect(sent.some((mail) => mail.to === "ops@example.com" && mail.subject.includes("工单"))).toBe(true);

  await prisma.siteSetting.update({ where: { id: "default" }, data: { notifyNewTickets: false } });
  sent.length = 0;
  expect((await openTicket(ip, { subject: "静音工单" })).status).toBe(200);
  expect(sent.some((mail) => mail.to === "ops@example.com")).toBe(false);

  const product = await prisma.product.create({
    data: { name: "通知商品", description: "测试", priceCents: 2500, active: true },
  });
  const order = await prisma.order.create({
    data: {
      orderNo: `P${Date.now()}`,
      userId: owner.user.id,
      status: "PENDING",
      totalCents: 2500,
      subtotalCents: 2500,
      items: { create: { productId: product.id, productName: "通知商品", unitPriceCents: 2500, quantity: 1 } },
    },
  });
  await prisma.siteSetting.update({ where: { id: "default" }, data: { notifyPaidOrders: true, notifyNewTickets: true } });
  sent.length = 0;
  const paid = await confirmOrderPayment({
    orderNo: order.orderNo,
    provider: "MOCK",
    providerEventId: `evt-${order.orderNo}`,
    amountCents: 2500,
    method: "MOCK",
    success: true,
  });
  expect(paid).toMatchObject({ ok: true, applied: true });
  expect(sent.some((mail) => mail.to === owner.email)).toBe(true);
  expect(sent.some((mail) => mail.to === "ops@example.com" && mail.text.includes(order.orderNo))).toBe(true);

  vi.mocked(consoleMailer.send).mockRejectedValue(new Error("smtp down"));
  const still = await openTicket(ip, { subject: "邮件挂了" });
  expect(still.status).toBe(200);
  expect(await prisma.ticket.findFirst({ where: { subject: "邮件挂了", userId: owner.user.id } })).toBeTruthy();
});

it("rate-limits ticket creation and accepts a validated screenshot", async () => {
  const ip = nextIp();
  const owner = await signIn("USER", ip);
  for (let n = 0; n < 3; n += 1) {
    const res = await openTicket(ip, { subject: `限额${n}` });
    expect(res.status).toBe(200);
  }
  const limited = await openTicket(ip, { subject: "超限了" });
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBeTruthy();

  const png = await sharp({
    create: { width: 12, height: 8, channels: 3, background: { r: 20, g: 40, b: 80 } },
  }).png().toBuffer();
  const form = new FormData();
  form.set("purpose", "ticket");
  form.set("file", new File([png], "shot.png", { type: "image/png" }));
  const headers = new Headers({ "x-real-ip": ip });
  const uploaded = await upload(new NextRequest("http://127.0.0.1/api/uploads", { method: "POST", headers, body: form }));
  expect(uploaded.status).toBe(200);
  const { url } = await uploaded.json();
  expect(url).toMatch(/^\/uploads\/tickets\/[0-9a-f-]+\.webp$/);

  const other = nextIp();
  await signIn("USER", other);
  const foreign = await createTicket(jsonRequest("/api/tickets", {
    ip: other,
    body: { subject: "别人的图", category: "other", body: "试试", attachments: [url] },
  }));
  expect(foreign.status).toBe(200);
  const stored = await prisma.ticketAttachment.findFirst({ where: { url } });
  expect(stored).toBeTruthy();
  expect(owner.email).toContain("@");
});
