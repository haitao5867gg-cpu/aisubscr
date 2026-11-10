import { getPaymentNotificationParser, getPaymentSignatureVerifier } from "./signature";
import { PaymentProviderNotReadyError, type NotificationRequest, type PaymentProvider, type VerifiedNotification } from "./types";

const REQUIRED = ["ALIPAY_APP_ID", "ALIPAY_PRIVATE_KEY", "ALIPAY_PUBLIC_KEY", "ALIPAY_NOTIFY_URL"] as const;

function filled(name: string) {
  const value = process.env[name]?.trim() ?? "";
  return value.length > 0 && !/^<.+>$/.test(value) && value !== "changeme";
}

/**
 * Skeleton only. createPayment never contacts Alipay.
 * verifyNotification stays closed until an adapter registers both
 * setPaymentSignatureVerifier("ALIPAY", ...) and
 * setPaymentNotificationParser("ALIPAY", ...).
 */
export const alipayProvider: PaymentProvider = {
  name: "ALIPAY",
  isConfigured() {
    return REQUIRED.every((name) => filled(name));
  },
  async createPayment() {
    throw new PaymentProviderNotReadyError("ALIPAY");
  },
  async verifyNotification(input: NotificationRequest): Promise<VerifiedNotification> {
    const verify = getPaymentSignatureVerifier("ALIPAY");
    if (!verify || !(await verify(input))) return { ok: false, reason: "invalid_signature" };
    const parser = getPaymentNotificationParser("ALIPAY");
    if (!parser) return { ok: false, reason: "not_implemented" };
    return parser(input);
  },
};
