import { expect, test, type Page } from "@playwright/test";

let octet = 110;

test.beforeEach(async ({ page }, info) => {
  octet += 1;
  const host = (Date.now() + octet * 7 + info.retry * 40) % 200 + 20;
  await page.setExtraHTTPHeaders({ "x-real-ip": `203.0.113.${host}` });
});

async function noSideScroll(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("main")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, path).toBeLessThanOrEqual(1);
}

test("phone-width storefront and account pages stay within the viewport", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/products", "/help", "/contact", "/login", "/cart", "/blog"]) {
    await noSideScroll(page, path);
  }
  const product = page.getByRole("link", { name: "选择此方案" }).first();
  await page.goto("/products");
  await product.click();
  await expect(page).toHaveURL(/\/products\//);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const email = `mobile-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("secret12");
  await page.getByRole("button", { name: "注册账号" }).click();
  await expect(page).toHaveURL(/\/account$/);
  for (const path of ["/account", "/account/security", "/orders"]) {
    await noSideScroll(page, path);
  }
});
