import { prisma } from "@/lib/prisma";
import { assertCan, type AuthzUser } from "@/lib/authz";
import { aggregateBookingReport, calculateBookingFinancials, type BookingReportRow } from "@/domain/finance/calculations";

export interface ReportDateRange {
  from: Date;
  to: Date;
}

/** Builds per-booking report rows from source Payment/Refund/Expense rows — the aggregate
 * reports are always a sum of these, never a separately-maintained number. See
 * /docs/08-financial-rules.md. */
export async function buildBookingReportRows(businessId: string, range: ReportDateRange): Promise<BookingReportRow[]> {
  const bookings = await prisma.booking.findMany({
    where: { businessId, createdAt: { gte: range.from, lte: range.to } },
    include: { payments: { include: { refunds: true } }, expenses: true, service: true, address: true, worker: true },
  });

  return bookings.map((b) => {
    const totalClientPaidCents = b.payments.filter((p) => p.status === "SUCCEEDED").reduce((sum, p) => sum + p.amountCents, 0);
    const totalRefundedCents = b.payments.flatMap((p) => p.refunds).reduce((sum, r) => sum + r.amountCents, 0);
    const paymentProcessingFeeCents = b.payments.reduce((sum, p) => sum + p.feeCents, 0);
    const driverCostCents = b.expenses.filter((e) => e.category === "DRIVER_PAYMENT").reduce((sum, e) => sum + e.amountCents, 0);
    const fuelOrTravelExpenseCents = b.expenses.filter((e) => e.category === "FUEL").reduce((sum, e) => sum + e.amountCents, 0);
    const otherExpensesCents = b.expenses
      .filter((e) => !["DRIVER_PAYMENT", "FUEL"].includes(e.category))
      .reduce((sum, e) => sum + e.amountCents, 0);
    const depositCents = b.payments.filter((p) => p.type === "DEPOSIT" && p.status === "SUCCEEDED").reduce((sum, p) => sum + p.amountCents, 0);

    const financials = calculateBookingFinancials({
      servicePriceCents: b.service.basePriceCents,
      travelSurchargeCents: 0,
      tipsCents: b.payments.filter((p) => p.type === "TIP").reduce((sum, p) => sum + p.amountCents, 0),
      discountsCents: 0,
      totalClientPaidCents,
      totalRefundedCents,
      paymentProcessingFeeCents,
      driverCostCents,
      fuelOrTravelExpenseCents,
      otherExpensesCents,
      platformFeeCents: 0,
      workerEarningsModel: "COMMISSION",
      workerCommissionRate: b.worker.commissionRate ?? 0.7,
    });

    return {
      id: b.id,
      workerId: b.workerId,
      serviceId: b.serviceId,
      suburb: b.address?.suburb ?? "Unknown",
      status: b.status,
      clientId: b.clientId,
      createdAt: b.createdAt,
      financials,
      depositCents,
      refundsCents: totalRefundedCents,
    };
  });
}

export async function getBusinessFinancialReport(admin: AuthzUser, range: ReportDateRange) {
  assertCan(admin, "view_business_financials");
  const rows = await buildBookingReportRows(admin.businessId, range);
  return aggregateBookingReport(rows);
}
