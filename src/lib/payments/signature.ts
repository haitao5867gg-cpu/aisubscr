import { createHmac, timingSafeEqual } from "crypto";
import type { NotificationRequest, VerifiedNotification } from "./types";

export type SignatureVerifier = (input: NotificationRequest) => Promise<boolean> | boolean;
export type NotificationParser = (input: NotificationRequest) => Promise<VerifiedNotification> | VerifiedNotification;

const verifiers = new Map<string, SignatureVerifier>();
const parsers = new Map<string, NotificationParser>();

/**
 * Register the signature check for a future WeChat Pay or Alipay adapter.
 * The default WeChat and Alipay hooks are unset, so their notify route
 * rejects every body until a merchant adapter calls this.
 */
export function setPaymentSignatureVerifier(provider: string, verifier: SignatureVerifier) {
  verifiers.set(provider.toUpperCase(), verifier);
}

/** Register how a verified body becomes an order number, amount, and event id. */
export function setPaymentNotificationParser(provider: string, parser: NotificationParser) {
  parsers.set(provider.toUpperCase(), parser);
}

export function getPaymentSignatureVerifier(provider: string) {
  return verifiers.get(provider.toUpperCase());
}

export function getPaymentNotificationParser(provider: string) {
  return parsers.get(provider.toUpperCase());
}

/** Compare a hex HMAC-SHA256 of the raw body. Used by the mock notify route. */
export function verifyHmacSha256Hex(rawBody: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature.trim().toLowerCase());
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyMockNotification(input: NotificationRequest): boolean {
  return verifyHmacSha256Hex(input.rawBody, input.headers.get("x-payment-signature"), process.env.PAYMENT_WEBHOOK_SECRET);
}
