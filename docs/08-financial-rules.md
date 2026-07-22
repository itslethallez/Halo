# Financial Calculation Rules

Implemented in `domain/finance/calculations.ts` — pure functions over typed
inputs, no DB access, so they're unit-testable and reused identically by
per-booking snapshots and by the aggregate reporting queries.

## Per-booking fields

`servicePrice`, `travelSurcharge`, `deposit`, `remainingBalance`, `tips`,
`discounts`, `refunds[]`, `paymentProcessingFee`, `driverCost`,
`fuelOrTravelExpense`, `otherExpenses[]`, `workerEarnings`,
`businessCommission`, `platformFee`, `grossRevenue`, `netProfit`.

## Core formulas

```
grossRevenue     = servicePrice + travelSurcharge + tips - discounts
totalClientPaid  = sum(Payment.amount for this booking)   // deposit + balance + tip, as actually collected
totalRefunded    = sum(Refund.amount for this booking)
jobExpenses      = driverCost + fuelOrTravelExpense + sum(otherExpenses) + paymentProcessingFee

netProfit = totalClientPaid - totalRefunded - driverCost - paymentProcessingFee - sum(otherExpenses) - fuelOrTravelExpense
```

This matches the spec's rule verbatim: *"Net profit = total client payments
minus refunds, driver costs, payment fees and other recorded job expenses."*

```
workerEarnings     = servicePrice_component_owed_to_worker (per worker's commission
                      or flat-fee arrangement, configured on Worker/Business)
businessCommission = grossRevenue - workerEarnings - platformFee   (business's own take)
platformFee        = configurable flat/percentage SaaS fee, 0 by default for a
                      single-business deployment, present for future multi-tenant billing
```

`workerEarnings` supports two configurable models per business:
**commission** (`workerEarnings = servicePrice * worker.commissionRate`) or
**flat/session-rate** (`workerEarnings = worker.flatRatePerService`), chosen
per business at setup time, defaulting to commission.

## Aggregate reports

All aggregate reports (`services/reportingService.ts`) are computed by
summing the per-booking snapshot fields over a date range / grouping key —
never recomputed with different logic, so a "monthly revenue" number is
always consistent with the sum of that month's booking-level numbers.

Reports required by the spec, all filterable by date range and exportable to
CSV (`lib/csv.ts`):

- Daily / weekly / monthly / yearly revenue
- Gross revenue, net profit
- Worker earnings, driver earnings, driver costs
- Outstanding balances (`servicePrice + travelSurcharge - totalClientPaid`,
  where positive)
- Deposits collected, refunds
- Average booking value (`grossRevenue` averaged over completed bookings)
- Completed-booking count
- Cancellation rate (`cancelled / (cancelled + fully_completed + no_show)`)
- No-show rate (`no_show / (cancelled + fully_completed + no_show)`)
- Repeat-client rate (`clients with ≥2 fully-completed bookings / all clients
  with ≥1 fully-completed booking`, over the report window)
- Revenue by worker / by service / by suburb (address's suburb field)
- Most profitable services / service areas (ranked by summed `netProfit`)

## Rounding & currency

All monetary values are stored as integer cents (`Int` in Prisma) to avoid
floating-point drift; formatting to dollars happens only at the presentation
layer (`lib/currency.ts`). All calculations in `domain/finance/calculations.ts`
operate on integer cents and are covered by unit tests including edge cases
(zero-price, refund exceeding payment guarded against, partial refunds,
discount larger than price guarded against).
