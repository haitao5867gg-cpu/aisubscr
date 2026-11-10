import { expect, test, type Page } from "@playwright/test";
import { totpCode } from "../src/lib/totp";

function pathname(page: Page) {
  return new URL(page.url()).pathname;
}

test("an enrolled admin must enter a code, and a recovery code works once", async ({ page }) => {
  test.setTimeout(90_000);
  const secretBox = { value: "" };
  const recovery: string[] = [];

  try {
    await page.goto("/login?next=/admin/security");
    await page.getByLabel("邮箱").fill("e2e-totp@example.com");
    await page.getByLabel("密码").fill("e2e-admin-pass");
    await page.getByRole("button", { name: "登录" }).click();
    await expect.poll(() => pathname(page)).toBe("/admin/security");

    await page.getByRole("button", { name: "生成二维码" }).click();
    secretBox.value = (await page.getByTestId("totp-secret").innerText()).trim();
    await page.getByLabel("身份验证码").fill(totpCode(secretBox.value));
    await page.getByRole("button", { name: "确认开启" }).click();
    await expect(page.getByText("两步验证已开启")).toBeVisible();
    const codes = page.getByTestId("recovery-code");
    await expect(codes).toHaveCount(10);
    recovery.push(...(await codes.allInnerTexts()).map((code) => code.trim()));

    await page.getByRole("button", { name: "退出" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/login?next=/admin");
    await page.getByLabel("邮箱").fill("e2e-totp@example.com");
    await page.getByLabel("密码").fill("e2e-admin-pass");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page.getByLabel("身份验证码")).toBeVisible();
    await page.getByLabel("身份验证码").fill("000000");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page.getByText("验证码不正确")).toBeVisible();

    await page.getByLabel("身份验证码").fill(totpCode(secretBox.value, Date.now() + 30_000));
    await page.getByRole("button", { name: "登录" }).click();
    await expect.poll(() => pathname(page)).toBe("/admin");

    await page.getByRole("button", { name: "退出" }).click();
    await page.goto("/login?next=/account");
    await page.getByLabel("邮箱").fill("e2e-totp@example.com");
    await page.getByLabel("密码").fill("e2e-admin-pass");
    await page.getByRole("button", { name: "登录" }).click();
    await page.getByLabel("身份验证码").fill(recovery[0] ?? "");
    await page.getByRole("button", { name: "登录" }).click();
    await expect.poll(() => pathname(page)).toBe("/account");

    await page.getByRole("button", { name: "退出" }).click();
    await page.goto("/login");
    await page.getByLabel("邮箱").fill("e2e-totp@example.com");
    await page.getByLabel("密码").fill("e2e-admin-pass");
    await page.getByRole("button", { name: "登录" }).click();
    await page.getByLabel("身份验证码").fill(recovery[0] ?? "");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page.getByText("验证码不正确")).toBeVisible();
  } finally {
    if (!secretBox.value || recovery.length < 3) return;
    try {
      await page.goto("/login?next=/admin/security");
      if (pathname(page) !== "/admin/security") {
        await page.getByLabel("邮箱").fill("e2e-totp@example.com");
        await page.getByLabel("密码").fill("e2e-admin-pass");
        await page.getByRole("button", { name: "登录" }).click();
        await Promise.race([
          page.waitForURL((url) => url.pathname === "/admin/security"),
          page.getByLabel("身份验证码").waitFor(),
        ]);
        if (pathname(page) !== "/admin/security") {
          await page.getByLabel("身份验证码").fill(recovery[1] ?? "");
          await page.getByRole("button", { name: "登录" }).click();
          await expect.poll(() => pathname(page)).toBe("/admin/security");
        }
      }
      const password = page.getByLabel("当前密码");
      if (!(await password.isVisible().catch(() => false))) return;
      await password.fill("e2e-admin-pass");
      await page.getByLabel("身份验证码").fill(recovery[2] ?? "");
      await page.getByRole("button", { name: "关闭两步验证" }).click();
      await expect(page.getByText("两步验证未开启")).toBeVisible();
    } catch {
      // This account is only used by this test. A failed cleanup does not affect the shopper flows.
    }
  }
});
