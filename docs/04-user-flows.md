# Major User Flows

## 1. Client booking flow (AI-assisted)

1. Client opens booking page or messages the assistant.
2. Assistant greets, introduces itself as "[Worker]'s booking assistant".
3. Assistant asks desired service → shows options/duration/price from
   `Service` + `WorkerService` catalogue.
4. Assistant asks preferred date/time and address/suburb.
5. Service checks address against the worker's approved service areas
   (`Worker.serviceAreas`).
6. Service checks worker working hours + `WorkerAvailability` + existing
   `Booking`s + connected calendar busy blocks.
7. Booking engine computes candidate slots that leave enough time for travel,
   setup, pack-down and any return trip (see `05-booking-state-machine.md`
   and the domain module `domain/booking/availability.ts`).
8. If the appointment needs a driver (distance/time/business rule), engine
   checks driver availability before offering the slot.
9. Assistant offers only genuinely available options.
10. Client picks a slot; assistant collects name, mobile, email (or loads an
    existing verified client record by phone/email match).
11. If a deposit is required, assistant requests payment (payment adapter).
12. If the worker's rules require manual approval (new client, high-value
    booking, restricted client, etc.), booking is created in
    `AWAITING_WORKER_APPROVAL`; otherwise `CONFIRMED` directly.
13. Worker is notified; on approval booking → `CONFIRMED` (or → driver
    workflow if a driver is required).
14. Confirmation sent to client; reminders scheduled (background job).
15. Client can keep messaging the assistant for follow-up questions; any
    escalation trigger hands the conversation to the worker/admin.

## 2. Escalation flow

Any of: abusive/threatening language, out-of-scope request, inappropriate
language, payment dispute, existing safety flag on the client, repeated
identity/address changes, assistant uncertainty, or a worker-configured
manual-review trigger → `Conversation.needsHuman = true` +
`escalationReason` set + notification to worker/admin. The AI keeps
responding only with a holding message ("I've flagged this for [Worker] to
reply personally") until a human takes over (`Conversation.takenOverBy`).

## 3. Driver dispatch flow

1. Booking reaches a point that needs transport (`DRIVER_REQUIRED`).
2. `DriverJob` created in `UNASSIGNED`.
3. Driver-allocation engine scores available drivers (see
   `07-driver-allocation.md`) and returns a ranked list.
4. Worker/admin assigns manually, or the system auto-offers to the top match
   (`OFFERED`) depending on business configuration.
5. Driver accepts (`ACCEPTED`) or declines (`DECLINED` → next candidate
   offered) from their dashboard.
6. On the day: driver goes `EN_ROUTE_TO_WORKER` → `WORKER_COLLECTED` →
   `ARRIVED_AT_DESTINATION` → `WAITING` (if applicable) → `RETURN_TRIP_STARTED`
   (if a return leg is required) → `WORKER_RETURNED` → `COMPLETED`.
7. Every transition writes `DriverStatusHistory` and can trigger a
   notification (e.g. "driver arrival" to the worker).

## 4. Appointment day-of flow (worker safety)

`CONFIRMED` → worker taps **Start trip** (`WORKER_EN_ROUTE`, check-in
recorded) → **Arrived** (`WORKER_ARRIVED`, check-in recorded, optional address
verification) → **Start service** (`SERVICE_IN_PROGRESS`, expected end time
calculated from duration) → **End service** (`SERVICE_COMPLETED`, check-in
recorded). Missed check-ins (no check-in within a configurable grace period
past an expected time) trigger a `MISSED_CHECK_IN` alert to the driver /
trusted contact / admin. The worker can hit the **emergency button** at any
point, which immediately notifies admin + trusted contact + (if assigned)
driver, and can optionally share live location for the duration of the
incident.

## 5. Post-service survey flow

1. `SERVICE_COMPLETED` → status moves to `AWAITING_WORKER_SURVEY` and
   `AWAITING_CLIENT_SURVEY` concurrently (two independent sub-flags on the
   booking, both must clear before `FULLY_COMPLETED`).
2. Worker gets an in-app prompt + reminder job if not completed within a
   configurable window. Worker survey is private; answers feed the risk
   engine (`06-safety-risk-rules.md`), which writes a *recommended* client
   status; only significant/serious outcomes require an admin action to take
   effect on booking eligibility.
3. Client gets the satisfaction survey (with the intro message from the
   spec). Negative answers create an `AdminReviewTask`-style flag (modelled as
   a `SafetyIncident`/review record) — never an automatic worker penalty.
4. Booking reaches `FULLY_COMPLETED` once both surveys are in (or their
   reminder windows lapse, per business configuration — a booking is not held
   open forever waiting on an optional client survey).

## 6. Client safety-status change flow

1. Trigger: worker survey submission, a manually filed `SafetyIncident`, or
   an admin review of a client-satisfaction complaint.
2. Risk engine computes a *recommended* status + reason.
3. Low-severity outcomes (fully positive, minor-with-note) apply
   automatically and are logged.
4. Medium/high-severity outcomes are written as a *pending recommendation*
   visible on the admin dashboard's "Safety reviews" list; the client's
   effective status only changes once an admin confirms (or overrides) it.
5. Every actual status change (automatic or admin-confirmed) writes a
   `ClientSafetyStatusHistory` row with who/when/why.

## 7. Financial flow

Each payment/refund/expense event updates the booking's financial snapshot
(`domain/finance/calculateBookingFinancials.ts`), which feeds the reporting
aggregations described in `08-financial-rules.md`.
