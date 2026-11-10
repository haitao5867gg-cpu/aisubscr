import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/health/route";
import { middleware } from "@/middleware";

function healthRequest() {
  return new NextRequest("http://127.0.0.1/api/health", {
    headers: { "x-request-id": "health-check-1" },
  });
}

it("reports db, version, and commit and hides secrets", async () => {
  const previousCommit = process.env.GIT_COMMIT;
  const previousVersion = process.env.APP_VERSION;
  const previousSecret = process.env.SESSION_SECRET;
  process.env.GIT_COMMIT = "abc1234def";
  process.env.APP_VERSION = "0.1.0";
  process.env.SESSION_SECRET = "super-secret-session-value-32chars";
  try {
    const res = await GET(healthRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, db: true, version: "0.1.0", commit: "abc1234def" });
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("super-secret");
    expect(raw).not.toContain("DATABASE_URL");
    expect(raw).not.toContain("file:");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("content-security-policy")).toBeNull();
  } finally {
    restore("GIT_COMMIT", previousCommit);
    restore("APP_VERSION", previousVersion);
    restore("SESSION_SECRET", previousSecret);
  }
});

it("rejects a commit value that is not a git sha", async () => {
  const previous = process.env.GIT_COMMIT;
  process.env.GIT_COMMIT = "not a sha";
  try {
    const body = await (await GET(healthRequest())).json();
    expect(body.commit).toBeNull();
    expect(body.ok).toBe(true);
  } finally {
    restore("GIT_COMMIT", previous);
  }
});

it("is not rate limited", async () => {
  for (let i = 0; i < 8; i += 1) {
    expect((await GET(healthRequest())).status).toBe(200);
  }
});

it("skips the page CSP nonce", () => {
  const health = middleware(new NextRequest("http://127.0.0.1/api/health"));
  expect(health.headers.get("content-security-policy")).toBeNull();
  expect(health.headers.get("cache-control")).toContain("no-store");

  const page = middleware(new NextRequest("http://127.0.0.1/products"));
  const csp = page.headers.get("content-security-policy") ?? "";
  expect(csp).toContain("script-src");
  expect(csp).toContain("nonce-");
  expect(page.headers.get("x-request-id")).toBeTruthy();
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
