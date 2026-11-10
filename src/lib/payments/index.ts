import { alipayProvider } from "./alipay";
import { mockPaymentProvider } from "./mock";
import type { PaymentMethod, PaymentProvider, ProviderName } from "./types";
import { wechatPayProvider } from "./wechat";

const byName: Record<ProviderName, PaymentProvider> = {
  MOCK: mockPaymentProvider,
  WECHAT: wechatPayProvider,
  ALIPAY: alipayProvider,
};

/**
 * MOCK stays the default. A live provider is selected only when
 * PAYMENT_PROVIDER names it and every placeholder env var for it is set.
 * Even then, the skeleton createPayment refuses to invent a charge.
 */
export function getPaymentProvider(method: PaymentMethod): PaymentProvider {
  const selected = (process.env.PAYMENT_PROVIDER || "mock").trim().toLowerCase();
  if (selected === "wechat" && method === "WECHAT" && wechatPayProvider.isConfigured()) return wechatPayProvider;
  if (selected === "alipay" && method === "ALIPAY" && alipayProvider.isConfigured()) return alipayProvider;
  return mockPaymentProvider;
}

export function getProviderByName(name: string): PaymentProvider | null {
  const key = name.trim().toUpperCase();
  if (key === "MOCK" || key === "WECHAT" || key === "ALIPAY") return byName[key];
  return null;
}

export type { PaymentMethod, PaymentProvider, ProviderName };
export { mockPaymentProvider, wechatPayProvider, alipayProvider };
export { PaymentProviderNotReadyError } from "./types";
export { setPaymentNotificationParser, setPaymentSignatureVerifier } from "./signature";
