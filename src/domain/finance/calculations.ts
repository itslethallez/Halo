/**
 * Pure, framework-free financial calculations. All monetary values are integer cents.
 * See /docs/08-financial-rules.md for the rule narrative this file implements.
 */

export interface BookingFinancialInputs {
  servicePriceCents: number;
  travelSurchargeCents: number;
  tipsCents: number;
  discountsCents: number;
  totalClientPaidCents: number; // sum of successful Payment rows for this booking
  totalRefundedCents: number; // sum of Refund rows for this booking
  paymentProcessingFeeCents: number;
  driverCostCents: number;
  fuelOrTravelExpenseCents: number;
  otherExpensesCents: number;
  platformFeeCents: number;
  workerEarningsModel: "COMMISSION" | "FLAT_RATE";
  workerCommissionRate?: number; // 0..1, used when model is COMMISSION
  workerFlatRateCents?: number; // used when model is FLAT_RATE
}

export interface BookingFinancialSummary {
  grossRevenueCents: number;
  jobExpensesCents: number;
  netProfitCents: number;
  workerEarningsCents: number;
  businessCommissionCents: number;
  outstandingBalanceCents: number;
}

export class InvalidFinancialInputError extends Error {}

function assertNonNegative(value: number, field: string): void {
  if (value < 0) {
    throw new InvalidFinancialInputError(`${field} cannot be negative (got ${value})`);
  }
}

export function calculateBookingFinancials(input: BookingFinancialInputs): BookingFinancialSummary {
  assertNonNegative(input.servicePriceCents, "servicePriceCents");
  assertNonNegative(input.travelSurchargeCents, "travelSurchargeCents");
  assertNonNegative(input.tipsCents, "tipsCents");
  assertNonNegative(input.discountsCents, "discountsCents");
  assertNonNegative(input.totalClientPaidCents, "totalClientPaidCents");
  assertNonNegative(input.totalRefundedCents, "totalRefundedCents");

  if (input.totalRefundedCents > input.totalClientPaidCents) {
    throw new InvalidFinancialInputError("totalRefundedCents cannot exceed totalClientPaidCents");
  }
  if (input.discountsCents > input.servicePriceCents + input.travelSurchargeCents) {
    throw new InvalidFinancialInputError("discountsCents cannot exceed the priced components it discounts");
  }

  const grossRevenueCents =
    input.servicePriceCents + input.travelSurchargeCents + input.tipsCents - input.discountsCents;

  const jobExpensesCents =
    input.driverCostCents + input.fuelOrTravelExpenseCents + input.otherExpensesCents + input.paymentProcessingFeeCents;

  // Net profit = total client payments minus refunds, driver costs, payment fees and other
  // recorded job expenses (spec-verbatim formula).
  const netProfitCents =
    input.totalClientPaidCents -
    input.totalRefundedCents -
    input.driverCostCents -
    input.paymentProcessingFeeCents -
    input.otherExpensesCents -
    input.fuelOrTravelExpenseCents;

  const workerEarningsCents =
    input.workerEarningsModel === "COMMISSION"
      ? Math.round(input.servicePriceCents * (input.workerCommissionRate ?? 0))
      : input.workerFlatRateCents ?? 0;

  const businessCommissionCents = grossRevenueCents - workerEarningsCents - input.platformFeeCents;

  const outstandingBalanceCents = Math.max(
    0,
    input.servicePriceCents + input.travelSurchargeCents - input.totalClientPaidCents,
  );

  return {
    grossRevenueCents,
    jobExpensesCents,
    netProfitCents,
    workerEarningsCents,
    businessCommissionCents,
    outstandingBalanceCents,
  };
}

export interface BookingReportRow {
  id: string;
  workerId: string;
  serviceId: string;
  suburb: string;
  status: "FULLY_COMPLETED" | "CANCELLED" | "NO_SHOW" | string;
  clientId: string;
  createdAt: Date;
  financials: BookingFinancialSummary;
  depositCents: number;
  refundsCents: number;
}

export interface AggregateReport {
  grossRevenueCents: number;
  netProfitCents: number;
  workerEarningsCents: number;
  driverCostsCents: number;
  outstandingBalanceCents: number;
  depositsCollectedCents: number;
  refundsCents: number;
  averageBookingValueCents: number;
  completedBookingCount: number;
  cancellationRate: number;
  noShowRate: number;
  repeatClientRate: number;
}

export function aggregateBookingReport(rows: BookingReportRow[]): AggregateReport {
  const completed = rows.filter((r) => r.status === "FULLY_COMPLETED");
  const cancelled = rows.filter((r) => r.status === "CANCELLED");
  const noShow = rows.filter((r) => r.status === "NO_SHOW");
  const outcomeDenominator = completed.length + cancelled.length + noShow.length;

  const sum = (fn: (r: BookingReportRow) => number) => completed.reduce((acc, r) => acc + fn(r), 0);

  const grossRevenueCents = sum((r) => r.financials.grossRevenueCents);
  const netProfitCents = sum((r) => r.financials.netProfitCents);
  const workerEarningsCents = sum((r) => r.financials.workerEarningsCents);
  const driverCostsCents = sum((r) => r.financials.jobExpensesCents);
  const outstandingBalanceCents = sum((r) => r.financials.outstandingBalanceCents);
  const depositsCollectedCents = sum((r) => r.depositCents);
  const refundsCents = sum((r) => r.refundsCents);

  const clientCounts = new Map<string, number>();
  for (const r of completed) {
    clientCounts.set(r.clientId, (clientCounts.get(r.clientId) ?? 0) + 1);
  }
  const repeatClients = [...clientCounts.values()].filter((count) => count >= 2).length;
  const totalClients = clientCounts.size;

  return {
    grossRevenueCents,
    netProfitCents,
    workerEarningsCents,
    driverCostsCents,
    outstandingBalanceCents,
    depositsCollectedCents,
    refundsCents,
    averageBookingValueCents: completed.length > 0 ? Math.round(grossRevenueCents / completed.length) : 0,
    completedBookingCount: completed.length,
    cancellationRate: outcomeDenominator > 0 ? cancelled.length / outcomeDenominator : 0,
    noShowRate: outcomeDenominator > 0 ? noShow.length / outcomeDenominator : 0,
    repeatClientRate: totalClients > 0 ? repeatClients / totalClients : 0,
  };
}

function groupSumCents(rows: BookingReportRow[], keyFn: (r: BookingReportRow) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows.filter((row) => row.status === "FULLY_COMPLETED")) {
    const key = keyFn(r);
    map.set(key, (map.get(key) ?? 0) + r.financials.netProfitCents);
  }
  return map;
}

export function revenueByWorker(rows: BookingReportRow[]): Map<string, number> {
  return groupSumCents(rows, (r) => r.workerId);
}

export function revenueByService(rows: BookingReportRow[]): Map<string, number> {
  return groupSumCents(rows, (r) => r.serviceId);
}

export function revenueBySuburb(rows: BookingReportRow[]): Map<string, number> {
  return groupSumCents(rows, (r) => r.suburb);
}

export function mostProfitable(map: Map<string, number>, limit = 5): Array<{ key: string; netProfitCents: number }> {
  return [...map.entries()]
    .map(([key, netProfitCents]) => ({ key, netProfitCents }))
    .sort((a, b) => b.netProfitCents - a.netProfitCents)
    .slice(0, limit);
}
