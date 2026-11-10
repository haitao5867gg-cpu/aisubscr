import { NextRequest, NextResponse } from "next/server";
import { analyticsPath, recordPageView } from "@/lib/analytics";
import { clientIp } from "@/lib/client-ip";
import { logApiError, requestIdFrom } from "@/lib/server-log";

/**
 * First-party beacon. The response never echoes the visitor address.
 * A failure here does not affect the page that sent it.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { path?: unknown; referrer?: unknown } | null;
  const path = typeof body?.path === "string" ? body.path : "";
  if (!analyticsPath(path)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    await recordPageView({
      path,
      referrer: typeof body?.referrer === "string" ? body.referrer : "",
      userAgent: req.headers.get("user-agent") ?? "",
      ip: clientIp(req.headers),
      selfHost: req.headers.get("host") ?? "",
    });
  } catch (error) {
    logApiError({ requestId: requestIdFrom(req.headers), route: "/api/analytics/collect", status: 200, error });
  }
  return NextResponse.json({ ok: true });
}
