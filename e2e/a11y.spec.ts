import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

let octet = 80;

test.beforeEach(async ({ page }, info) => {
  octet += 1;
  const host = (Date.now() + octet * 19 + info.retry * 40) % 200 + 20;
  await page.setExtraHTTPHeaders({ "x-real-ip": `198.51.100.${host}` });
});

async function audit(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
  }));
  expect(summary, `${path} @ ${width}px`).toEqual([]);
}

const publicPages = ["/help", "/contact", "/forgot-password", "/privacy", "/terms", "/refund"];
const accountPages = ["/account", "/account/security", "/tickets", "/tickets/new"];
const adminPages = [
  "/admin",
  "/admin/analytics",
  "/admin/orders",
  "/admin/products",
  "/admin/users",
  "/admin/audit",
  "/admin/tickets",
  "/admin/blog",
  "/admin/coupons",
  "/admin/faq",
  "/admin/settings",
  "/admin/security",
];

for (const width of [1280, 390]) {
  test(`public pages at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    for (const path of publicPages) await audit(page, path, width);
  });
}

test("account, tickets, coupons, and 2FA pages", async ({ page }) => {
  test.setTimeout(180_000);
  const email = `a11y-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill("secret12");
  await page.getByRole("button", { name: "注册账号" }).click();
  await expect(page).toHaveURL(/\/account$/);
  for (const width of [1280, 390]) {
    for (const path of accountPages) await audit(page, path, width);
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "退出" }).click();
  await page.goto("/login?next=/admin");
  await page.getByLabel("邮箱").fill("e2e-admin@example.com");
  await page.getByLabel("密码").fill("e2e-admin-pass");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  for (const width of [1280, 390]) {
    for (const path of adminPages) await audit(page, path, width);
  }
});
