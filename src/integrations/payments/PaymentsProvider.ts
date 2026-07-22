export interface CreatePaymentIntentInput {
  amountCents: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  providerReferenceId: string;
  clientSecret?: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
}

export interface RefundResult {
  providerRefundId: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
}

export interface PaymentsProvider {
  readonly providerName: string;
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>;
  refund(providerReferenceId: string, amountCents: number, reason?: string): Promise<RefundResult>;
}
