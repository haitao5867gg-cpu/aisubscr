import { expect, test } from "@playwright/test";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let octet = 140;

test.beforeEach(async ({ page }, info) => {
  octet += 1;
  const host = (Date.now() + octet * 13 + info.retry * 40) % 200 + 20;
  await page.setExtraHTTPHeaders({ "x-real-ip": `198.51.100.${host}` });
});

test("an admin upload is served immediately", async ({ page }) => {
  await page.goto("/login?next=/admin/products");
  await page.getByLabel("邮箱").fill("e2e-admin@example.com");
  await page.getByLabel("密码").fill("e2e-admin-pass");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);

  await page.locator("#new-file").setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator("#new-image")).toHaveValue(/^\/uploads\/products\/[0-9a-f-]+\.webp$/, { timeout: 20_000 });
  const url = await page.locator("#new-image").inputValue();

  const served = await page.request.get(url);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"] ?? "").toMatch(/^image\/webp\b/);
  expect(served.headers()["x-content-type-options"]).toBe("nosniff");
  expect(served.headers()["cache-control"] ?? "").toContain("immutable");
  expect(served.headers()["cache-control"] ?? "").not.toContain("no-store");
  const body = await served.body();
  expect(body.subarray(0, 4).toString("ascii")).toBe("RIFF");

  const missing = await page.request.get("/uploads/products/missing-file.webp");
  expect(missing.status()).toBe(404);
  expect(missing.headers()["cache-control"] ?? "").not.toContain("immutable");
});