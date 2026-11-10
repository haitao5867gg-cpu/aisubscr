import { getPaymentNotificationParser, getPaymentSignatureVerifier } from "./signature";
import { PaymentProviderNotReadyError, type NotificationRequest, type PaymentProvider, type VerifiedNotification } from "./types";

const REQUIRED = [
  "WECHAT_PAY_APP_ID",
  "WECHAT_PAY_MCH_ID",
  "WECHAT_PAY_API_V3_KEY",
  "WECHAT_PAY_MCH_SERIAL",
  "WECHAT_PAY_PRIVATE_KEY",
  "WECHAT_PAY_NOTIFY_URL",
] as const;

function filled(name: string) {
  const value = process.env[name]?.trim() ?? "";
  return value.length > 0 && !/^<.+>$/.test(value) && value !== "changeme";
}

/**
 * Skeleton only. createPayment never contacts WeChat.
 * verifyNotification stays closed until an adapter registers both
 * setPaymentSignatureVerifier("WECHAT", ...) and
 * setPaymentNotificationParser("WECHAT", ...).
 */
export const wechatPayProvider: PaymentProvider = {
  name: "WECHAT",
  isConfigured() {
    return REQUIRED.every((name) => filled(name));
  },
  async createPayment() {
    throw new PaymentProviderNotReadyError("WECHAT");
  },
  async verifyNotification(input: NotificationRequest): Promise<VerifiedNotification> {
    const verify = getPaymentSignatureVerifier("WECHAT");
    if (!verify || !(await verify(input))) return { ok: false, reason: "invalid_signature" };
    const parser = getPaymentNotificationParser("WECHAT");
    if (!parser) return { ok: false, reason: "not_implemented" };
    return parser(input);
  },
};
