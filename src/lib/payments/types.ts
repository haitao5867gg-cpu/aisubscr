export const PAYMENT_METHODS = ["WECHAT", "ALIPAY", "MOCK"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type ProviderName = "MOCK" | "WECHAT" | "ALIPAY";

export type CreatePaymentInput = {
  orderId: string;
  orderNo: string;
  amountCents: number;
  method: PaymentMethod;
  returnUrl: string;
  notifyUrl: string;
};

export type CreatePaymentResult = {
  provider: ProviderName;
  paymentId: string;
  /** Same-origin path for MOCK, or a future gateway URL. */
  redirectUrl: string;
  mocked: boolean;
};

export type NotificationRequest = {
  rawBody: string;
  headers: Headers;
  query: URLSearchParams;
};

export type VerifiedNotification =
  | {
      ok: true;
      orderNo: string;
      amountCents: number;
      /** Stable id for this notify. Retries must reuse it. */
      providerEventId: string;
      providerPaymentId: string;
      method: PaymentMethod;
      success: boolean;
    }
  | { ok: false; reason: string };

/**
 * A payment provider. MOCK is the only provider that completes checkout.
 * WeChat Pay and Alipay ship as skeletons: signature and body parsing are
 * hooks a merchant adapter registers later. They do not call a live gateway.
 */
export interface PaymentProvider {
  readonly name: ProviderName;
  isConfigured(): boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyNotification(input: NotificationRequest): Promise<VerifiedNotification>;
}

export class PaymentProviderNotReadyError extends Error {
  readonly provider: ProviderName;
  constructor(provider: ProviderName) {
    super(`${provider} is not ready`);
    this.name = "PaymentProviderNotReadyError";
    this.provider = provider;
  }
}
