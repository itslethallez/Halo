import { describe, it, expect } from "vitest";
import {
  aggregateBookingReport,
  calculateBookingFinancials,
  InvalidFinancialInputError,
  mostProfitable,
  revenueByService,
  revenueBySuburb,
  revenueByWorker,
  type BookingFinancialInputs,
  type BookingReportRow,
} from "../calculations";

function inputs(overrides: Partial<BookingFinancialInputs> = {}): BookingFinancialInputs {
  return {
    servicePriceCents: 15000,
    travelSurchargeCents: 0,
    tipsCents: 0,
    discountsCents: 0,
    totalClientPaidCents: 15000,
    totalRefundedCents: 0,
    paymentProcessingFeeCents: 450,
    driverCostCents: 0,
    fuelOrTravelExpenseCents: 0,
    otherExpensesCents: 0,
    platformFeeCents: 0,
    workerEarningsModel: "COMMISSION",
    workerCommissionRate: 0.7,
    ...overrides,
  };
}

describe("calculateBookingFinancials", () => {
  it("computes net profit per the spec formula: client payments minus refunds, driver costs, fees, expenses", () => {
    const result = calculateBookingFinancials(
      inputs({ driverCostCents: 2000, otherExpensesCents: 500, totalRefundedCents: 1000 }),
    );
    // 15000 - 1000 - 2000 - 450 - 500 - 0
    expect(result.netProfitCents).toBe(11050);
  });

  it("computes gross revenue as service + surcharge + tips - discounts", () => {
    const result = calculateBookingFinancials(
      inputs({ travelSurchargeCents: 2000, tipsCents: 1000, discountsCents: 500 }),
    );
    expect(result.grossRevenueCents).toBe(15000 + 2000 + 1000 - 500);
  });

  it("computes worker earnings under a commission model", () => {
    const result = calculateBookingFinancials(inputs({ workerCommissionRate: 0.6 }));
    expect(result.workerEarningsCents).toBe(9000);
  });

  it("computes worker earnings under a flat-rate model", () => {
    const result = calculateBookingFinancials(
      inputs({ workerEarningsModel: "FLAT_RATE", workerFlatRateCents: 8000 }),
    );
    expect(result.workerEarningsCents).toBe(8000);
  });

  it("computes outstanding balance when the client has not fully paid", () => {
    const result = calculateBookingFinancials(inputs({ totalClientPaidCents: 5000 }));
    expect(result.outstandingBalanceCents).toBe(10000);
  });

  it("floors outstanding balance at zero when overpaid (e.g. tip included)", () => {
    const result = calculateBookingFinancials(inputs({ totalClientPaidCents: 16000 }));
    expect(result.outstandingBalanceCents).toBe(0);
  });

  it("rejects a refund total exceeding what the client actually paid", () => {
    expect(() => calculateBookingFinancials(inputs({ totalRefundedCents: 20000 }))).toThrow(
      InvalidFinancialInputError,
    );
  });

  it("rejects a discount exceeding the priced components", () => {
    expect(() => calculateBookingFinancials(inputs({ discountsCents: 999999 }))).toThrow(
      InvalidFinancialInputError,
    );
  });

  it("rejects negative inputs", () => {
    expect(() => calculateBookingFinancials(inputs({ servicePriceCents: -100 }))).toThrow(
      InvalidFinancialInputError,
    );
  });

  it("handles a fully-refunded, zero-net-profit booking without going negative in unexpected ways", () => {
    const result = calculateBookingFinancials(
      inputs({ totalClientPaidCents: 15000, totalRefundedCents: 15000, driverCostCents: 0, otherExpensesCents: 0 }),
    );
    expect(result.netProfitCents).toBe(-450); // still out the processing fee
  });
});

function row(overrides: Partial<BookingReportRow> = {}): BookingReportRow {
  return {
    id: "b1",
    workerId: "w1",
    serviceId: "s1",
    suburb: "Bondi",
    status: "FULLY_COMPLETED",
    clientId: "c1",
    createdAt: new Date("2026-07-01"),
    financials: calculateBookingFinancials(inputs()),
    depositCents: 5000,
    refundsCents: 0,
    ...overrides,
  };
}

describe("aggregateBookingReport", () => {
  it("only counts completed bookings toward revenue/profit sums", () => {
    const rows = [row(), row({ id: "b2", status: "CANCELLED" }), row({ id: "b3", status: "NO_SHOW" })];
    const report = aggregateBookingReport(rows);
    expect(report.completedBookingCount).toBe(1);
    expect(report.grossRevenueCents).toBe(row().financials.grossRevenueCents);
  });

  it("computes cancellation and no-show rates over completed+cancelled+no-show", () => {
    const rows = [row(), row({ id: "b2" }), row({ id: "b3", status: "CANCELLED" }), row({ id: "b4", status: "NO_SHOW" })];
    const report = aggregateBookingReport(rows);
    expect(report.cancellationRate).toBeCloseTo(0.25);
    expect(report.noShowRate).toBeCloseTo(0.25);
  });

  it("computes repeat-client rate from completed bookings only", () => {
    const rows = [
      row({ id: "b1", clientId: "c1" }),
      row({ id: "b2", clientId: "c1" }),
      row({ id: "b3", clientId: "c2" }),
    ];
    const report = aggregateBookingReport(rows);
    expect(report.repeatClientRate).toBeCloseTo(1 / 2);
  });

  it("computes average booking value over completed bookings", () => {
    const rows = [row({ id: "b1" }), row({ id: "b2" })];
    const report = aggregateBookingReport(rows);
    expect(report.averageBookingValueCents).toBe(row().financials.grossRevenueCents);
  });

  it("returns zeros for an empty report with no divide-by-zero errors", () => {
    const report = aggregateBookingReport([]);
    expect(report.averageBookingValueCents).toBe(0);
    expect(report.cancellationRate).toBe(0);
    expect(report.repeatClientRate).toBe(0);
  });
});

describe("grouped revenue reports", () => {
  const rows = [
    row({ id: "b1", workerId: "w1", serviceId: "svc-a", suburb: "Bondi" }),
    row({ id: "b2", workerId: "w2", serviceId: "svc-b", suburb: "Manly" }),
    row({ id: "b3", workerId: "w1", serviceId: "svc-a", suburb: "Bondi" }),
    row({ id: "b4", status: "CANCELLED", workerId: "w1" }),
  ];

  it("groups net profit by worker, excluding non-completed bookings", () => {
    const byWorker = revenueByWorker(rows);
    expect(byWorker.get("w1")).toBe(row().financials.netProfitCents * 2);
    expect(byWorker.get("w2")).toBe(row().financials.netProfitCents);
  });

  it("groups net profit by service and by suburb", () => {
    expect(revenueByService(rows).get("svc-a")).toBe(row().financials.netProfitCents * 2);
    expect(revenueBySuburb(rows).get("Bondi")).toBe(row().financials.netProfitCents * 2);
  });

  it("ranks most-profitable entries descending", () => {
    const ranked = mostProfitable(revenueByWorker(rows));
    expect(ranked[0]?.key).toBe("w1");
  });
});
