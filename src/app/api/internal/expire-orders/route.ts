import { NextRequest, NextResponse } from "next/server";
import { cronAuth, expireDueOrders } from "@/lib/order-expiry";

/**
 * Idempotent sweep for unpaid orders. A cron calls this with
 * `Authorization: Bearer $CRON_SECRET` (at least 16 characters).
 * When the secret is unset the route is hidden.
 */
export async function POST(req: NextRequest) {
  const auth = cronAuth(req.headers.get("authorization"));
  if (auth === "disabled") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (auth === "denied") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await expireDueOrders();
  return NextResponse.json({ ok: true, ...result });
}
