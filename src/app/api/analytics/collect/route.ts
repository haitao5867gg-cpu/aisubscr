import { NextRequest, NextResponse } from "next/server";
import { getDict } from "@/i18n";
import { getLocale } from "@/i18n/server";
import { analyticsPath, recordPageView } from "@/lib/analytics";
import { consumeAnalyticsCollect } from "@/lib/auth-rate-limit";
import { clientIp } from "@/lib/client-ip";
import { ANALYTICS_JSON_MAX, readMutationJson } from "@/lib/request-guard";
import { logApiError, requestIdFrom } from "@/lib/server-log";

/**
 * First-party beacon. The response never echoes the visitor address.
 * A failure here does not affect the page that sent it.
 * Cross-site posts are rejected. One IP can only record a bounded number of views.
 */
export async function POST(req: NextRequest) {
  const t = getDict(await getLocale());
  const body = await readMutationJson(req, ANALYTICS_JSON_MAX, t.api.forbidden, t.api.payloadTooLarge);
  if (!body.ok) return body.response;

  const ip = clientIp(req.headers);
  const limit = await consumeAnalyticsCollect(ip);
  if (limit.limited) {
    return NextResponse.json(
      { error: t.api.rateLimited },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  }

  const payload = body.value as { path?: unknown; referrer?: unknown } | null;
  const path = typeof payload?.path === "string" ? payload.path : "";
  if (!analyticsPath(path)) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    await recordPageView({
      path,
      referrer: typeof payload?.referrer === "string" ? payload.referrer : "",
      userAgent: req.headers.get("user-agent") ?? "",
      ip,
      selfHost: req.headers.get("host") ?? "",
    });
  } catch (error) {
    logApiError({ requestId: requestIdFrom(req.headers), route: "/api/analytics/collect", status: 200, error });
  }
  return NextResponse.json({ ok: true });
}
