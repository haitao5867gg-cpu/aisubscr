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

it("sets umask 022 and chowns the release before the symlink moves", () => {
  const script = readFileSync("scripts/deploy.sh", "utf8");
  const executable = script
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  expect(executable[0]).toBe("set -euo pipefail");
  expect(executable[1]).toBe("umask 022");
  expect(script).toContain('SERVICE_USER="${SERVICE_USER:-aisubscr}"');
  expect(script).toContain('"${CHOWN[@]}" -RP -- "${SERVICE_USER}:" "$real"');
  const body = executable.join("\n");
  const own = body.indexOf('own_release "$release"');
  const switched = body.indexOf('switch_current "$release"');
  expect(own).toBeGreaterThan(-1);
  expect(switched).toBeGreaterThan(own);
  const rollback = body.slice(body.indexOf("rollback() {"), body.indexOf("on_exit() {"));
  const rollbackOwn = rollback.indexOf('own_release "$previous_target"');
  const rollbackSwitch = rollback.indexOf('switch_current "$previous_target"');
  expect(rollbackOwn).toBeGreaterThan(-1);
  expect(rollbackSwitch).toBeGreaterThan(rollbackOwn);
});

it("keeps a bounded release history and health-checks an explicit rollback", () => {
  const script = readFileSync("scripts/deploy.sh", "utf8");
  expect(script).toContain('KEEP_RELEASES="${KEEP_RELEASES:-5}"');
  expect(script).toContain('PREVIOUS_FILE="${PREVIOUS_FILE:-$SHARED_DIR/previous-release}"');
  expect(script).toContain("--rollback");
  expect(script).toContain("perform_rollback");
  const flag = script.slice(script.indexOf("perform_rollback() {"), script.indexOf("prune_old_releases() {"));
  expect(flag).toContain("wait_healthy");
  expect(flag).toContain('switch_current "$previous"');
  expect(flag).toContain("record_previous");
  expect(flag).not.toContain("npm ci");
  expect(flag).not.toContain("prisma migrate");
  expect(flag).not.toContain("db:seed");
  const prune = script.slice(script.indexOf("prune_old_releases() {"), script.indexOf('mkdir -p -- "$RELEASES_DIR"'));
  expect(prune).toContain("current_real");
  expect(prune).toContain("previous_real");
  expect(prune).toContain('safe_rm_release "$path"');
  expect(prune).toContain('[[ "$index" -le "$keep" ]] && continue');
});
