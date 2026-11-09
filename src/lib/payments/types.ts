export type PaymentMethod = "WECHAT" | "ALIPAY" | "MOCK";

export type CreatePaymentInput = {
  orderId: string;
  orderNo: string;
  amountCents: number;
  method: PaymentMethod;
  returnUrl: string;
};

export type CreatePaymentResult = {
  provider: string;
  paymentId: string;
  /** URL or path to complete payment (mock redirects to confirm endpoint) */
  redirectUrl: string;
  mocked: boolean;
};

export interface PaymentProvider {
  name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Confirm a mock/callback payment; real providers would verify webhook signatures */
  confirmPayment?(paymentId: string, orderId: string): Promise<{ ok: boolean }>;
}
