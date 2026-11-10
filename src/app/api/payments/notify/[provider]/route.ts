import { NextRequest, NextResponse } from "next/server";
import { confirmOrderPayment } from "@/lib/payments/confirm";
import { getProviderByName } from "@/lib/payments";

const MAX_BODY = 64 * 1024;

function ack(provider: string, status: number, reason: string) {
  if (provider === "ALIPAY") {
    return new NextResponse(status === 200 ? "success" : "fail", {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return NextResponse.json(
    { code: status === 200 ? "SUCCESS" : "FAIL", reason },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Gateway notify skeleton. MOCK verifies HMAC-SHA256 of the raw body with
 * PAYMENT_WEBHOOK_SECRET. WECHAT and ALIPAY reject the body until a merchant
 * adapter registers a signature verifier and a notification parser.
 * Confirmation is idempotent on (provider, event id).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: rawName } = await params;
  const provider = getProviderByName(rawName);
  if (!provider) return NextResponse.json({ code: "FAIL", reason: "unknown_provider" }, { status: 404 });

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY) return ack(provider.name, 413, "body_too_large");

  const verified = await provider.verifyNotification({
    rawBody,
    headers: req.headers,
    query: req.nextUrl.searchParams,
  });
  if (!verified.ok) {
    const status = verified.reason === "invalid_signature" ? 401 : 400;
    return ack(provider.name, status, verified.reason);
  }

  const result = await confirmOrderPayment({
    orderNo: verified.orderNo,
    provider: provider.name,
    providerEventId: verified.providerEventId,
    amountCents: verified.amountCents,
    method: verified.method,
    success: verified.success,
  });
  if (!result.ok) {
    const status = result.reason === "NOT_FOUND" ? 404 : 400;
    return ack(provider.name, status, result.reason);
  }
  return ack(provider.name, 200, "SUCCESS");
}

export function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
