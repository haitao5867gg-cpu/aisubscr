import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";

let octet = 140;

test.beforeEach(async ({ page }, info) => {
  octet += 1;
  const host = (Date.now() + octet * 17 + info.retry * 40) % 200 + 20;
  await page.setExtraHTTPHeaders({ "x-real-ip": `203.0.113.${host}` });
});

test("dashboard shows paid revenue, the funnel, and a low-stock product", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/login?next=/admin/products");
  await page.getByLabel("邮箱").fill("e2e-admin@example.com");
  await page.getByLabel("密码").fill("e2e-admin-pass");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);

  const row = page.locator("details").filter({ hasText: "示例商品 A" });
  const stock = row.getByLabel("库存", { exact: true });
  if (!(await stock.isVisible())) await row.locator("summary").click();
  await stock.fill("");
  await row.getByLabel("低库存阈值", { exact: true }).fill("5");
  await row.getByRole("button", { name: "保存" }).click();
  await expect(row.locator("summary")).not.toContainText("低库存");

  await page.getByRole("button", { name: "退出" }).click();
  const email = `dash-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("secret12");
  await page.getByRole("button", { name: "注册账号" }).click();
  await expect(page).toHaveURL(/\/account$/);

  const viewed = page.waitForResponse((res) => res.url().includes("/api/analytics/collect") && res.request().method() === "POST");
  await page.goto("/");
  await viewed;
  await page.getByRole("link", { name: "选择此方案" }).first().click();
  await page.getByRole("button", { name: "加入结算" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.getByRole("button", { name: "提交订单" }).click();
  await expect(page).toHaveURL(/\/orders\//);
  await page.getByRole("button", { name: "去支付" }).click();
  await expect(page.getByText("支付成功")).toBeVisible();

  await page.getByRole("button", { name: "退出" }).click();
  await page.goto("/login?next=/admin/products");
  await page.getByLabel("邮箱").fill("e2e-admin@example.com");
  await page.getByLabel("密码").fill("e2e-admin-pass");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  if (!(await stock.isVisible())) await row.locator("summary").click();
  await stock.fill("2");
  await row.getByLabel("低库存阈值", { exact: true }).fill("5");
  await row.getByRole("button", { name: "保存" }).click();
  await expect(row.locator("summary")).toContainText("低库存");

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "今日", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "近 7 日", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "近 30 日", exact: true })).toBeVisible();
  const today = page.locator("article").filter({ has: page.getByRole("heading", { name: "今日", exact: true }) });
  await expect(today).toContainText("已支付");
  await expect(today).toContainText(/收入 ¥(?!0\.00)/);
  await expect(page.getByRole("heading", { name: "近 7 日收入", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /近 7 日收入/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "热门商品", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "转化", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "浏览", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "提交订单", exact: true })).toBeVisible();
  const paid = page.locator("article").filter({ has: page.getByRole("heading", { name: "已支付", exact: true }) });
  await expect(paid.locator(".stat-num")).not.toHaveText("0");
  const low = page.locator("section").filter({ has: page.getByRole("heading", { name: "低库存", exact: true }) });
  await expect(low.getByRole("link", { name: "示例商品 A" })).toBeVisible();
  await expect(low).toContainText("库存 2");
  await expect(low).toContainText("低库存阈值 5");

  await page.getByRole("button", { name: "English" }).click();
  const lowEn = page.locator("section").filter({ has: page.getByRole("heading", { name: "Low stock", exact: true }) });
  await expect(lowEn.getByRole("heading", { name: "Low stock", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Revenue, last 7 days", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top products", exact: true })).toBeVisible();
  await expect(lowEn.getByRole("link", { name: "示例商品 A" })).toBeVisible();
  await page.getByRole("button", { name: "中文" }).click();
  await expect(low.getByRole("heading", { name: "低库存", exact: true })).toBeVisible();

  if (existsSync("/opt/cursor/artifacts")) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: "/opt/cursor/artifacts/admin_dashboard_desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "/opt/cursor/artifacts/admin_dashboard_mobile.png", fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "低库存", exact: true })).toBeVisible();
  await expect(low.getByRole("link", { name: "示例商品 A" })).toBeVisible();
});
