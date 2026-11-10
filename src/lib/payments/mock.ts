import { getPaymentNotificationParser, getPaymentSignatureVerifier, verifyMockNotification } from "./signature";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  NotificationRequest,
  PaymentMethod,
  PaymentProvider,
  VerifiedNotification,
} from "./types";

function asMethod(value: unknown): PaymentMethod {
  return value === "WECHAT" || value === "ALIPAY" || value === "MOCK" ? value : "MOCK";
}

/** Local preview provider. The pay page says 模拟支付. No money moves. */
export const mockPaymentProvider: PaymentProvider = {
  name: "MOCK",
  isConfigured() {
    return true;
  },
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const paymentId = `mock_${input.orderNo}_${Date.now()}`;
    const redirectUrl = `/api/orders/${input.orderId}/mock-pay?paymentId=${encodeURIComponent(paymentId)}&method=${input.method}`;
    return {
      provider: "MOCK",
      paymentId,
      redirectUrl,
      mocked: true,
    };
  },
  async verifyNotification(input: NotificationRequest): Promise<VerifiedNotification> {
    const verify = getPaymentSignatureVerifier("MOCK") ?? verifyMockNotification;
    if (!(await verify(input))) return { ok: false, reason: "invalid_signature" };
    const custom = getPaymentNotificationParser("MOCK");
    if (custom) return custom(input);
    let body: unknown;
    try {
      body = JSON.parse(input.rawBody);
    } catch {
      return { ok: false, reason: "invalid_body" };
    }
    if (!body || typeof body !== "object") return { ok: false, reason: "invalid_body" };
    const record = body as Record<string, unknown>;
    const orderNo = typeof record.orderNo === "string" ? record.orderNo : "";
    const providerEventId = typeof record.eventId === "string" ? record.eventId : "";
    const amountCents = record.amountCents;
    if (!orderNo || !providerEventId || typeof amountCents !== "number" || !Number.isInteger(amountCents)) {
      return { ok: false, reason: "invalid_body" };
    }
    const providerPaymentId = typeof record.paymentId === "string" && record.paymentId ? record.paymentId : providerEventId;
    return {
      ok: true,
      orderNo,
      amountCents,
      providerEventId,
      providerPaymentId,
      method: asMethod(record.method),
      success: record.success !== false,
    };
  },
};
