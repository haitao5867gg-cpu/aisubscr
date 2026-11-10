import { mkdir } from "node:fs/promises";
import { expect, request as playwrightRequest, test } from "@playwright/test";
import { E2E_BASE_URL } from "./env";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let octet = 40;

test.beforeEach(async ({ page }, info) => {
  octet += 1;
  const host = (Date.now() + octet * 17 + info.retry * 40) % 200 + 20;
  await page.setExtraHTTPHeaders({ "x-real-ip": `203.0.113.${host}` });
});

async function register(page: import("@playwright/test").Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("secret12");
  await page.getByRole("button", { name: "注册账号" }).click();
  await expect(page).toHaveURL(/\/account$/);
}

test("a customer opens a ticket and cannot read someone else's", async ({ page }) => {
  const email = `ticket-${Date.now()}@example.com`;
  const subject = `支付后没有看到订单 ${email}`;
  await register(page, email);
  await page.goto("/tickets/new");
  await page.getByRole("textbox", { name: "主题" }).fill(subject);
  await page.getByLabel("分类").selectOption("billing");
  await page.getByLabel("问题描述").fill("订单号在个人中心找不到。");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page).toHaveURL(/\/tickets\/(?!new(?:$|\/))/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();
  const ticketUrl = page.url();

  await page.getByLabel("回复").fill("补充：是刚才那一笔。");
  await page.getByRole("button", { name: "回复" }).click();
  await expect(page.getByText("补充：是刚才那一笔。")).toBeVisible();

  if (!process.env.CI) {
    await mkdir("/opt/cursor/artifacts", { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: "/opt/cursor/artifacts/ticket-thread-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "/opt/cursor/artifacts/ticket-thread-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
  }

  await page.getByRole("button", { name: "退出" }).click();
  await page.setExtraHTTPHeaders({ "x-real-ip": `198.51.100.${(Date.now() % 200) + 20}` });
  const other = `other-${Date.now()}@example.com`;
  await register(page, other);
  await page.goto(ticketUrl);
  await expect(page.getByRole("heading", { name: "页面不存在" })).toBeVisible();

  await page.getByRole("button", { name: "退出" }).click();
  await page.goto("/login?next=/admin/tickets");
  await page.getByLabel("邮箱").fill("e2e-admin@example.com");
  await page.getByLabel("密码").fill("e2e-admin-pass");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/tickets/);
  const row = page.getByRole("link", { name: email });
  await expect(row).toBeVisible();
  if (!process.env.CI) {
    await page.screenshot({ path: "/opt/cursor/artifacts/admin-ticket-inbox.png", fullPage: true });
  }
  await row.click();
  await page.getByLabel("回复").fill("已经在订单列表里，请刷新。");
  await page.getByRole("button", { name: "回复" }).click();
  await expect(page.getByText("已经在订单列表里，请刷新。")).toBeVisible();

  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { name: "访问统计" })).toBeVisible();
  await expect(page.getByText("不保存 IP")).toBeVisible();
  if (!process.env.CI) {
    await page.screenshot({ path: "/opt/cursor/artifacts/admin-analytics.png", fullPage: true });
  }
});

test("user B cannot fetch user A's ticket or screenshot", async ({ page }) => {
  const email = `shot-${Date.now()}@example.com`;
  await register(page, email);
  const uploaded = await page.request.post("/api/uploads", {
    multipart: {
      purpose: "ticket",
      file: { name: "shot.png", mimeType: "image/png", buffer: PNG },
    },
  });
  expect(uploaded.status()).toBe(200);
  const uploadBody = await uploaded.json();
  expect(uploadBody.url).toMatch(/^\/api\/tickets\/uploads\//);

  const created = await page.request.post("/api/tickets", {
    data: {
      subject: `截图只有本人能看 ${email}`,
      category: "technical",
      body: "这张图里有订单页面。",
      attachments: [uploadBody.url],
    },
  });
  expect(created.status()).toBe(200);
  const { ticket } = await created.json();
  const shot = ticket.replies[0].attachments[0].url as string;
  expect(shot).toMatch(/^\/api\/tickets\/attachments\//);
  expect(JSON.stringify(ticket)).not.toContain("/uploads/tickets/");

  const own = await page.request.get(shot);
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toContain("image/webp");
  expect(own.headers()["cache-control"]).toContain("private");

  const ticketUrl = `/tickets/${ticket.id}`;
  await page.goto(ticketUrl);
  await expect(page.getByRole("heading", { level: 1, name: ticket.subject })).toBeVisible();
  const image = page.locator("img[alt='工单截图']");
  await expect(image).toBeVisible();
  expect(await image.getAttribute("src")).toBe(shot);

  await page.getByRole("button", { name: "退出" }).click();
  const anon = await playwrightRequest.newContext({ baseURL: E2E_BASE_URL });
  expect((await anon.get(shot)).status()).toBe(401);
  expect((await anon.get(`/api/tickets/${ticket.id}`)).status()).toBe(401);
  await anon.dispose();

  await page.setExtraHTTPHeaders({ "x-real-ip": `198.51.100.${(Date.now() % 200) + 20}` });
  await register(page, `other-shot-${Date.now()}@example.com`);
  expect((await page.request.get(shot)).status()).toBe(404);
  expect((await page.request.get(`/api/tickets/${ticket.id}`)).status()).toBe(404);
  await page.goto(ticketUrl);
  await expect(page.getByRole("heading", { name: "页面不存在" })).toBeVisible();
});
