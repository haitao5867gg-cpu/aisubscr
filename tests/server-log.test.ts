import { expect, it, vi } from "vitest";
import { onRequestError } from "@/instrumentation";
import { logApiError } from "@/lib/server-log";

it("writes one stderr line with request id, route, and status", () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const secret = "super-secret-session-value-32chars";
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = secret;
  try {
    logApiError({
      requestId: "req-12345678",
      route: "/api/auth/login",
      status: 500,
      error: new Error(`db down ${secret}`),
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0][0]);
    expect(line).not.toContain("\n");
    const parsed = JSON.parse(line) as { requestId: string; route: string; status: number; error: { message: string } };
    expect(parsed).toMatchObject({
      level: "error",
      requestId: "req-12345678",
      route: "/api/auth/login",
      status: 500,
    });
    expect(parsed.error.message).toContain("[redacted]");
    expect(parsed.error.message).not.toContain(secret);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
    spy.mockRestore();
  }
});

it("logs uncaught API route errors from instrumentation", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await onRequestError(new Error("boom"), { path: "/api/orders", method: "POST", headers: { "x-request-id": "req-uncaught" } }, {
      routerKind: "App Router",
      routePath: "/api/orders",
      routeType: "route",
    });
    const parsed = JSON.parse(String(spy.mock.calls[0][0])) as { requestId: string; route: string; status: number };
    expect(parsed).toMatchObject({ requestId: "req-uncaught", route: "/api/orders", status: 500 });
  } finally {
    spy.mockRestore();
  }
});
