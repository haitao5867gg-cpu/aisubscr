import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_DATABASE_URL, E2E_PORT, E2E_SESSION_SECRET } from "./e2e/env";

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL: E2E_BASE_URL,
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: `mkdir -p /tmp/aisubscr-e2e && rm -f /tmp/aisubscr-e2e/test.db /tmp/aisubscr-e2e/test.db-journal && npx prisma migrate deploy && npx tsx e2e/seed.ts && npx next start -H 127.0.0.1 -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: E2E_DATABASE_URL,
      SESSION_SECRET: E2E_SESSION_SECRET,
      MAIL_PROVIDER: "console",
      PAYMENT_PROVIDER: "mock",
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: E2E_BASE_URL,
      GIT_COMMIT: process.env.GIT_COMMIT && /^[0-9a-f]{7,40}$/i.test(process.env.GIT_COMMIT) ? process.env.GIT_COMMIT : "abc1234def",
    },
  },
});
