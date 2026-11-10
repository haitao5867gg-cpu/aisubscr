import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

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
  await register(page, email);
  await page.goto("/tickets/new");
  await page.getByRole("textbox", { name: "主题" }).fill("支付后没有看到订单");
  await page.getByLabel("分类").selectOption("billing");
  await page.getByLabel("问题描述").fill("订单号在个人中心找不到。");
  await page.getByRole("button", { name: "提交" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "支付后没有看到订单" })).toBeVisible();
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
  await page.setExtraHTTPHeaders({ "x-real-ip": "203.0.113.19" });
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
  await expect(page.getByRole("link", { name: /支付后没有看到订单/ })).toBeVisible();
  if (!process.env.CI) {
    await page.screenshot({ path: "/opt/cursor/artifacts/admin-ticket-inbox.png", fullPage: true });
  }
  await page.getByRole("link", { name: /支付后没有看到订单/ }).click();
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
