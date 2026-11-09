import { mockPaymentProvider } from "./mock";
import type { PaymentMethod, PaymentProvider } from "./types";

/**
 * Pluggable payment registry.
 * Real WeChat Pay / Alipay merchants plug in here with credentials later.
 * Until then every method routes through MOCK (模拟支付).
 */
const providers: Record<string, PaymentProvider> = {
  MOCK: mockPaymentProvider,
};

export function getPaymentProvider(_method: PaymentMethod): PaymentProvider {
  // Future: if (method === "WECHAT" && process.env.WECHAT_MCH_ID) return wechatProvider;
  return providers.MOCK;
}

export type { PaymentMethod, PaymentProvider };
export { mockPaymentProvider };
