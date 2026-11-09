import type { CreatePaymentInput, CreatePaymentResult, PaymentProvider } from "./types";

/** Local preview provider — clearly marked 模拟支付. No real money moved. */
export const mockPaymentProvider: PaymentProvider = {
  name: "MOCK",
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
  async confirmPayment() {
    return { ok: true };
  },
};
