import path from "node:path";
import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/db";

const SESSION_SECRET = "vitest-session-secret-at-least-32-characters";

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = SESSION_SECRET;
process.env.MAIL_PROVIDER = "console";
process.env.PAYMENT_PROVIDER = "mock";
process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3000";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    server: {
      deps: {
        external: ["sharp", "@aws-sdk/client-s3"],
      },
    },
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_SECRET,
      MAIL_PROVIDER: "console",
      PAYMENT_PROVIDER: "mock",
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
    },
  },
});
