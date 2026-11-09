import { chromium } from "playwright";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const base = "http://127.0.0.1:3000";
const ids = JSON.parse(
  require("child_process").execSync("npx tsx scripts/getids.ts", { encoding: "utf8" }).trim()
);
const admin = Object.fromEntries(
  fs
    .readFileSync("/workspace/aisubscr/ADMIN_CREDENTIALS.txt", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function shot(path, name) {
  const res = await page.goto(base + path, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `/workspace/aisubscr/screenshots/${name}`, fullPage: true });
  console.log("saved", name, res?.status());
}

await shot("/", "01-home.png");
await shot("/products", "02-products.png");
await shot(`/products/${ids.productId}`, "03-product-detail.png");
await shot("/login", "04-login.png");
await shot("/blog", "05-blog.png");
await shot(`/order/${ids.token}`, "06-public-order.png");

await page.goto(base + "/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"]', admin.email);
await page.fill('input[type="password"]', admin.password);
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle" }),
  page.click('button[type="submit"]'),
]);
await shot("/admin", "07-admin.png");
await shot("/admin/orders", "08-admin-orders.png");
await shot("/admin/settings", "09-admin-settings.png");

// dark mode screenshot of home
await page.evaluate(() => {
  localStorage.setItem("aisubscr-theme", "dark");
  document.documentElement.classList.add("dark");
});
await shot("/", "10-home-dark.png");

await browser.close();
console.log("SHOTS_DONE");
