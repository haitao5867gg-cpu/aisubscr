import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

export const TEST_DATABASE_URL = "file:/tmp/aisubscr-vitest/test.db";

export function prepareTestDatabase() {
  rmSync("/tmp/aisubscr-vitest", { recursive: true, force: true });
  mkdirSync("/tmp/aisubscr-vitest", { recursive: true });
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
