import type { CreatePaymentIntentInput, PaymentIntentResult, PaymentsProvider, RefundResult } from "./PaymentsProvider";

/** DEV adapter: simulates an instantly-succeeding payment. No credentials or card handling. */
export class DevPaymentsProvider implements PaymentsProvider {
  readonly providerName = "DEV_MOCK";

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    console.log(`[dev-payments] creating payment intent for ${input.amountCents} ${input.currency}: ${input.description}`);
    return { providerReferenceId: `dev-pi-${Date.now()}`, status: "SUCCEEDED" };
  }

  async refund(providerReferenceId: string, amountCents: number): Promise<RefundResult> {
    console.log(`[dev-payments] refunding ${amountCents} cents against ${providerReferenceId}`);
    return { providerRefundId: `dev-refund-${Date.now()}`, status: "SUCCEEDED" };
  }
}
