import { prisma } from "@/lib/prisma";
import { getPaymentsProvider } from "@/integrations/payments";
import { recordAudit } from "./auditService";
import type { PaymentStatus, PaymentType } from "@prisma/client";

export interface CreatePaymentInput {
  businessId: string;
  bookingId: string;
  type: PaymentType;
  amountCents: number;
  description: string;
}

/** Creates a payment via the configured payments provider and records the resulting status.
 * Only ever stores a provider reference id — never raw card data. See
 * /docs/10-legal-privacy-security-risks.md #13. */
export async function createPayment(input: CreatePaymentInput) {
  const provider = getPaymentsProvider();
  const intent = await provider.createPaymentIntent({
    amountCents: input.amountCents,
    currency: "AUD",
    description: input.description,
    metadata: { bookingId: input.bookingId },
  });

  return prisma.payment.create({
    data: {
      businessId: input.businessId,
      bookingId: input.bookingId,
      type: input.type,
      amountCents: input.amountCents,
      status: intent.status,
      providerReferenceId: intent.providerReferenceId,
    },
  });
}

const ALLOWED_PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: ["REFUNDED", "PARTIALLY_REFUNDED"],
  PARTIALLY_REFUNDED: ["REFUNDED", "PARTIALLY_REFUNDED"],
  FAILED: [],
  REFUNDED: [],
};

export class IllegalPaymentTransitionError extends Error {}

export async function updatePaymentStatus(paymentId: string, toStatus: PaymentStatus) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (!ALLOWED_PAYMENT_STATUS_TRANSITIONS[payment.status].includes(toStatus)) {
    throw new IllegalPaymentTransitionError(`Cannot move payment from ${payment.status} to ${toStatus}`);
  }
  return prisma.payment.update({ where: { id: paymentId }, data: { status: toStatus } });
}

export interface RefundInput {
  businessId: string;
  paymentId: string;
  amountCents: number;
  reason?: string;
}

export async function refundPayment(input: RefundInput) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
  if (payment.status !== "SUCCEEDED" && payment.status !== "PARTIALLY_REFUNDED") {
    throw new IllegalPaymentTransitionError(`Cannot refund a payment in status ${payment.status}`);
  }

  const provider = getPaymentsProvider();
  await provider.refund(payment.providerReferenceId ?? "", input.amountCents, input.reason);

  const existingRefunds = await prisma.refund.aggregate({ where: { paymentId: input.paymentId }, _sum: { amountCents: true } });
  const totalRefunded = (existingRefunds._sum.amountCents ?? 0) + input.amountCents;
  const nextStatus: PaymentStatus = totalRefunded >= payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED";

  const [refund] = await prisma.$transaction([
    prisma.refund.create({ data: { paymentId: input.paymentId, amountCents: input.amountCents, reason: input.reason } }),
    prisma.payment.update({ where: { id: input.paymentId }, data: { status: nextStatus } }),
  ]);

  await recordAudit({
    businessId: input.businessId,
    action: "PAYMENT_REFUNDED",
    entityType: "Payment",
    entityId: input.paymentId,
    metadata: { amountCents: input.amountCents, nextStatus },
  });

  return refund;
}
