import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPayment, IllegalPaymentTransitionError, refundPayment, updatePaymentStatus } from "../paymentService";
import { createTestBusiness, createTestClient, createTestService, createTestWorker, createTestBooking } from "./testHelpers";

async function makeBooking() {
  const business = await createTestBusiness();
  const { worker } = await createTestWorker(business.id);
  const { client } = await createTestClient(business.id);
  const service = await createTestService(business.id);
  const booking = await createTestBooking({ businessId: business.id, clientId: client.id, workerId: worker.id, serviceId: service.id });
  return { business, booking };
}

describe("payment status changes", () => {
  it("creates a payment that starts SUCCEEDED via the dev payments provider", async () => {
    const { business, booking } = await makeBooking();
    const payment = await createPayment({ businessId: business.id, bookingId: booking.id, type: "DEPOSIT", amountCents: 5000, description: "Deposit" });
    expect(payment.status).toBe("SUCCEEDED");
    expect(payment.providerReferenceId).toBeTruthy();
  });

  it("allows a legal transition from PENDING to SUCCEEDED", async () => {
    const { business, booking } = await makeBooking();
    const payment = await prisma.payment.create({
      data: { businessId: business.id, bookingId: booking.id, type: "BALANCE", amountCents: 10000, status: "PENDING" },
    });
    const updated = await updatePaymentStatus(payment.id, "SUCCEEDED");
    expect(updated.status).toBe("SUCCEEDED");
  });

  it("rejects an illegal transition from FAILED to SUCCEEDED", async () => {
    const { business, booking } = await makeBooking();
    const payment = await prisma.payment.create({
      data: { businessId: business.id, bookingId: booking.id, type: "BALANCE", amountCents: 10000, status: "FAILED" },
    });
    await expect(updatePaymentStatus(payment.id, "SUCCEEDED")).rejects.toThrow(IllegalPaymentTransitionError);
  });

  it("moves a fully-refunded payment to REFUNDED and a partial refund to PARTIALLY_REFUNDED", async () => {
    const { business, booking } = await makeBooking();
    const payment = await createPayment({ businessId: business.id, bookingId: booking.id, type: "FULL_PAYMENT", amountCents: 20000, description: "Full payment" });

    const partial = await refundPayment({ businessId: business.id, paymentId: payment.id, amountCents: 5000, reason: "Partial goodwill refund" });
    expect(partial.amountCents).toBe(5000);
    let updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe("PARTIALLY_REFUNDED");

    await refundPayment({ businessId: business.id, paymentId: payment.id, amountCents: 15000, reason: "Remainder" });
    updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe("REFUNDED");
  });

  it("rejects refunding a payment that has not succeeded", async () => {
    const { business, booking } = await makeBooking();
    const payment = await prisma.payment.create({
      data: { businessId: business.id, bookingId: booking.id, type: "BALANCE", amountCents: 10000, status: "PENDING" },
    });
    await expect(refundPayment({ businessId: business.id, paymentId: payment.id, amountCents: 1000 })).rejects.toThrow(
      IllegalPaymentTransitionError,
    );
  });
});
