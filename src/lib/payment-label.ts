type PaymentLabels = {
  wechat: string;
  alipay: string;
  mock: string;
};

/** Shopper-facing name for a stored payment method. Unknown values stay visible. */
export function paymentMethodLabel(method: string | null | undefined, labels: PaymentLabels) {
  if (method === "WECHAT") return labels.wechat;
  if (method === "ALIPAY") return labels.alipay;
  if (method === "MOCK") return labels.mock;
  const raw = method?.trim() ?? "";
  return raw || "—";
}
