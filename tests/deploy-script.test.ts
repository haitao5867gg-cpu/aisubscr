import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps seed and upload deletion out of the deploy script", () => {
  const script = readFileSync("scripts/deploy.sh", "utf8");
  const commands = script
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
  expect(commands).not.toMatch(/db:seed|db:setup|prisma db seed|migrate reset|db push/);
  expect(commands).toContain("prisma migrate deploy");
  expect(commands).toContain("prisma migrate status");
  expect(commands).not.toMatch(/rm\s+[^\n]*\$UPLOADS_DIR/);
  expect(commands).not.toMatch(/rm\s+[^\n]*\$DB_FILE/);
  expect(script).toContain("/api/health");
  expect(script).toContain("aisubscr-current");
});
