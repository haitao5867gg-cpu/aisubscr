import { expect, test } from "@playwright/test";

let octet = 20;

test.beforeEach(async ({ page }, info) => {
  octet += 1;
  const host = (Date.now() + octet * 13 + info.retry * 40) % 200 + 20;
  await page.setExtraHTTPHeaders({ "x-real-ip": `198.51.100.${host}` });
});

test("home, health, plans redirect, structured data, and unknown paths", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const organization = await page.locator('script[type="application/ld+json"]').textContent();
  expect(organization).toContain("Organization");
  expect(organization).toContain("aisubscr");

  await page.getByRole("link", { name: "查看方案" }).first().click();
  await expect(page).toHaveURL(/\/products$/);

  await page.goto("/plans");
  await expect(page).toHaveURL(/\/products$/);
  await page.getByRole("link", { name: "选择此方案" }).first().click();
  await expect(page).toHaveURL(/\/products\//);
  const productLd = await page.locator('script[type="application/ld+json"]').textContent();
  expect(productLd).toContain("Product");
  expect(productLd).toContain("CNY");

  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  const body = await health.json();
  expect(body).toMatchObject({ ok: true, db: true });
  expect(body).toHaveProperty("version");
  expect(body).toHaveProperty("commit");
  expect(JSON.stringify(body)).not.toContain("SESSION_SECRET");
  expect(health.headers()["content-security-policy"]).toBeUndefined();

  await page.goto("/this-page-is-missing");
  await expect(page.getByRole("heading", { name: "页面不存在" })).toBeVisible();
});

test("forgot password sends an unknown email to register", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("邮箱").fill("missing@example.com");
  await page.getByRole("button", { name: "发送验证码" }).click();
  await expect(page.getByText("该邮箱尚未注册")).toBeVisible();
  await page.waitForURL(/\/register\?/);
  const url = new URL(page.url());
  expect(url.pathname).toBe("/register");
  expect(url.searchParams.get("email")).toBe("missing@example.com");
  await expect(page.getByLabel("邮箱")).toHaveValue("missing@example.com");
});

test("register, logout, and login", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "secret12";

  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "注册账号" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.getByRole("button", { name: "退出" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/account$/);
});

test("add to cart, mock pay, and mark the order paid", async ({ page }) => {
  const email = `pay-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("secret12");
  await page.getByRole("button", { name: "注册账号" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto("/");
  await page.getByRole("link", { name: "选择此方案" }).click();
  await page.getByRole("button", { name: "加入结算" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText("示例商品 A", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "提交订单" }).click();
  await expect(page).toHaveURL(/\/orders\//);
  await page.getByRole("button", { name: "去支付" }).click();
  await expect(page.getByText("支付成功")).toBeVisible();
  await expect(page.locator(".badge-paid").first()).toHaveText("已支付");
});

test("account security changes the password and keeps this session", async ({ page }) => {
  const email = `sec-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("secret12");
  await page.getByRole("button", { name: "注册账号" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto("/account/security");
  await expect(page.getByRole("heading", { name: "账号安全" })).toBeVisible();
  await page.getByLabel("当前密码").fill("secret12");
  await page.getByLabel("新密码", { exact: true }).fill("secret13");
  await page.getByLabel("再输入一次新密码").fill("secret13");
  await page.getByRole("button", { name: "修改密码" }).click();
  await expect(page.getByText("密码已更新")).toBeVisible();
  await expect(page).toHaveURL(/\/account\/security$/);

  await page.getByRole("button", { name: "退出" }).click();
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("secret12");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByText("邮箱或密码错误")).toBeVisible();
  await page.getByLabel("密码").fill("secret13");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/account$/);
});

test("footer, help, policies, and contact are linked", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("示例公告")).toBeVisible();
  await page.getByRole("link", { name: "服务条款" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("note")).toContainText("占位文本");
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "隐私政策" })).toBeVisible();
  await page.goto("/refund");
  await expect(page.getByRole("heading", { name: "退款政策" })).toBeVisible();
  await page.goto("/help");
  await expect(page.getByText("支付会真实扣款吗？")).toBeVisible();
  await page.goto("/contact");
  await expect(page.getByText("aisubscr-demo")).toBeVisible();
  await expect(page.getByText("10000")).toBeVisible();
});

test("the language switch changes the home page copy", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pick a plan");
  await expect(page.getByRole("link", { name: "View plans" }).first()).toBeVisible();
  await page.goto("/products");
  await expect(page.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/help");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Help center");
  await page.getByRole("button", { name: "中文" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("帮助中心");
});

test("a promo code discounts checkout and the unpaid order shows a countdown", async ({ page }) => {
  const email = `coupon-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("secret12");
  await page.getByRole("button", { name: "注册账号" }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto("/");
  await page.getByRole("link", { name: "选择此方案" }).click();
  await page.getByRole("button", { name: "加入结算" }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.getByLabel("优惠码").fill("SAVE10");
  await page.getByRole("button", { name: "使用" }).click();
  await expect(page.getByText("¥89.10")).toBeVisible();
  await page.getByRole("button", { name: "提交订单" }).click();
  await expect(page).toHaveURL(/\/orders\//);
  await expect(page.getByText("SAVE10")).toBeVisible();
  await expect(page.getByText("¥89.10")).toBeVisible();
  await expect(page.getByText(/请在 \d{2}:\d{2} 内完成支付/)).toBeVisible();
});

test("admin dashboard is staff-only", async ({ page }) => {
  const email = `shopper-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("secret12");
  await page.getByRole("button", { name: "注册账号" }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/admin/coupons");
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/admin/faq");
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/login?next=/admin");
  await page.getByLabel("邮箱").fill("e2e-admin@example.com");
  await page.getByLabel("密码").fill("e2e-admin-pass");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "今日", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "近 7 日收入", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "最近订单", exact: true })).toBeVisible();
  await page.goto("/admin/coupons");
  await expect(page.getByRole("heading", { name: "优惠码", exact: true })).toBeVisible();
  await page.goto("/admin/faq");
  await expect(page.getByRole("heading", { name: "帮助中心", exact: true })).toBeVisible();
});
