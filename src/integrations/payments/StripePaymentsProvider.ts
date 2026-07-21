import type { CreatePaymentIntentInput, PaymentIntentResult, PaymentsProvider, RefundResult } from "./PaymentsProvider";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Live payments require this (see .env.example). Set INTEGRATION_MODE=dev to use the mock adapter instead.`);
  }
  return value;
}

/**
 * Live adapter for Stripe. Requires STRIPE_SECRET_KEY. Card data is handled entirely by
 * Stripe's hosted fields/Elements on the client — this server-side adapter only ever sees
 * amounts and a provider reference id (PCI-DSS SAQ-A posture, see
 * /docs/10-legal-privacy-security-risks.md #13).
 */
export class StripePaymentsProvider implements PaymentsProvider {
  readonly providerName = "STRIPE";

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    const secretKey = requireEnv("STRIPE_SECRET_KEY");
    const response = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: String(input.amountCents),
        currency: input.currency.toLowerCase(),
        description: input.description,
        ...Object.fromEntries(Object.entries(input.metadata ?? {}).map(([k, v]) => [`metadata[${k}]`, v])),
      }),
    });
    if (!response.ok) {
      throw new Error(`Stripe payment intent creation failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as { id: string; client_secret: string; status: string };
    return {
      providerReferenceId: data.id,
      clientSecret: data.client_secret,
      status: data.status === "succeeded" ? "SUCCEEDED" : "PENDING",
    };
  }

  async refund(providerReferenceId: string, amountCents: number, reason?: string): Promise<RefundResult> {
    const secretKey = requireEnv("STRIPE_SECRET_KEY");
    const response = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        payment_intent: providerReferenceId,
        amount: String(amountCents),
        ...(reason ? { reason } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`Stripe refund failed: ${response.status} ${await response.text()}`);
    }
    const data = (await response.json()) as { id: string; status: string };
    return { providerRefundId: data.id, status: data.status === "succeeded" ? "SUCCEEDED" : "PENDING" };
  }
}
