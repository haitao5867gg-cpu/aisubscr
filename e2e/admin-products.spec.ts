import { expect, test } from "@playwright/test";

let octet = 90;

test.beforeEach(async ({ page }, info) => {
  octet += 1;
  const host = (Date.now() + octet * 11 + info.retry * 40) % 200 + 20;
  await page.setExtraHTTPHeaders({ "x-real-ip": `192.0.2.${host}` });
});

test("an admin creates, edits, unlists, and deletes a product", async ({ page }) => {
  test.setTimeout(60_000);
  const name = `冒烟商品 ${Date.now()}`;
  await page.goto("/login?next=/admin/products");
  await page.getByLabel("邮箱").fill("e2e-admin@example.com");
  await page.getByLabel("密码").fill("e2e-admin-pass");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);

  await page.locator("#new-name").fill(name);
  await page.locator("#new-description").fill("质量回归用的商品，不含账号交付。");
  await page.locator("#new-price").fill("12.50");
  await page.locator("form").filter({ has: page.locator("#new-name") }).getByRole("button", { name: "保存" }).click();

  const row = page.locator("details").filter({ hasText: name });
  await expect(row.locator("summary")).toContainText("¥12.50");
  await expect(row.locator("summary")).toContainText("上架");

  await page.goto("/products");
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();

  await page.goto("/admin/products");
  if (!(await row.getByLabel("价格（元）").isVisible())) await row.locator("summary").click();
  await row.getByLabel("价格（元）").fill("15.00");
  await row.getByRole("checkbox", { name: "在商城显示" }).uncheck();
  await row.getByRole("button", { name: "保存" }).click();
  await expect(row.locator("summary")).toContainText("¥15.00");
  await expect(row.locator("summary")).toContainText("下架");

  await page.goto("/products");
  await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);

  await page.goto("/admin/products");
  if (!(await row.getByRole("button", { name: "删除" }).isVisible())) await row.locator("summary").click();
  await row.getByRole("button", { name: "删除" }).click();
  await expect(page.locator("details").filter({ hasText: name })).toHaveCount(0);
});
