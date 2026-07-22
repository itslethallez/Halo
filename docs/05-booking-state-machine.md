# Booking State Machine

Implemented in `domain/booking/statusMachine.ts` as an explicit transition
table (`ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]>`) so
illegal transitions throw rather than silently happening. Every transition is
recorded in `BookingStatusHistory` with `fromStatus`, `toStatus`,
`changedByUserId` (nullable for system transitions), `reason`, `createdAt`.

## States

| Status | Meaning |
|---|---|
| `NEW_ENQUIRY` | Client has started a conversation but no service/time chosen yet |
| `AVAILABILITY_OFFERED` | Assistant has offered candidate slots |
| `AWAITING_CLIENT_RESPONSE` | Waiting on client to pick a slot / respond |
| `AWAITING_DEPOSIT` | Slot chosen, deposit requested, not yet paid |
| `AWAITING_WORKER_APPROVAL` | Deposit paid (or not required) but business rules require manual approval |
| `CONFIRMED` | Approved, no driver required, scheduled |
| `DRIVER_REQUIRED` | Confirmed appointment that needs transport, no job created/assigned yet |
| `DRIVER_ASSIGNED` | A `DriverJob` has been accepted by a driver |
| `WORKER_EN_ROUTE` | Worker (or driver) has started travelling |
| `WORKER_ARRIVED` | Worker has checked in at the location |
| `SERVICE_IN_PROGRESS` | Service has started |
| `SERVICE_COMPLETED` | Service finished, pre-survey |
| `AWAITING_WORKER_SURVEY` | Worker safety survey outstanding |
| `AWAITING_CLIENT_SURVEY` | Client satisfaction survey outstanding |
| `FULLY_COMPLETED` | Both surveys in (or lapsed per policy); terminal success state |
| `CANCELLED` | Cancelled by client, worker or admin before service |
| `NO_SHOW` | Client (or worker, flagged separately) did not show |
| `SAFETY_REVIEW` | Held pending a safety concern; requires admin action to proceed |
| `BLOCKED` | Will not proceed — client/booking blocked |

`AWAITING_WORKER_SURVEY` and `AWAITING_CLIENT_SURVEY` are modelled as two
independent boolean-ish sub-states on the booking (`workerSurveyDone`,
`clientSurveyDone`) rather than mutually exclusive statuses, since both can be
outstanding simultaneously; the `status` column shows whichever is more
relevant/blocking for the primary dashboard view, and `FULLY_COMPLETED` is only
reachable when both are true (or lapsed).

## Transition table (summary)

```
NEW_ENQUIRY            -> AVAILABILITY_OFFERED, CANCELLED
AVAILABILITY_OFFERED   -> AWAITING_CLIENT_RESPONSE, CANCELLED
AWAITING_CLIENT_RESPONSE -> AWAITING_DEPOSIT, AVAILABILITY_OFFERED, CANCELLED
AWAITING_DEPOSIT       -> AWAITING_WORKER_APPROVAL, CONFIRMED, CANCELLED
AWAITING_WORKER_APPROVAL -> CONFIRMED, DRIVER_REQUIRED, CANCELLED, SAFETY_REVIEW
CONFIRMED              -> DRIVER_REQUIRED, WORKER_EN_ROUTE, CANCELLED, NO_SHOW, SAFETY_REVIEW
DRIVER_REQUIRED        -> DRIVER_ASSIGNED, CANCELLED, SAFETY_REVIEW
DRIVER_ASSIGNED        -> WORKER_EN_ROUTE, CANCELLED
WORKER_EN_ROUTE        -> WORKER_ARRIVED, CANCELLED, SAFETY_REVIEW
WORKER_ARRIVED         -> SERVICE_IN_PROGRESS, SAFETY_REVIEW, NO_SHOW
SERVICE_IN_PROGRESS    -> SERVICE_COMPLETED, SAFETY_REVIEW
SERVICE_COMPLETED      -> AWAITING_WORKER_SURVEY, AWAITING_CLIENT_SURVEY, FULLY_COMPLETED
AWAITING_WORKER_SURVEY -> AWAITING_CLIENT_SURVEY, FULLY_COMPLETED, SAFETY_REVIEW
AWAITING_CLIENT_SURVEY -> AWAITING_WORKER_SURVEY, FULLY_COMPLETED
SAFETY_REVIEW          -> CONFIRMED, CANCELLED, BLOCKED  (admin only)
BLOCKED                -> (terminal; admin can re-open to CANCELLED for record-keeping only)
CANCELLED              -> (terminal)
NO_SHOW                -> (terminal)
FULLY_COMPLETED        -> (terminal)
```

## Double-booking prevention (the hard requirement)

`domain/booking/availability.ts::findAvailableSlots()` and
`assertNoConflict()` are the single choke point for scheduling. A candidate
slot `[start, end)` for a worker is valid only if **all** of the following
hold:

1. `start` is within a `WorkerAvailability` window for that day of week, and
   not inside a `BlockedTime` (blackout/holiday/personal event) range.
2. `start` respects `minimumNoticeHours` and `maximumAdvanceDays`.
3. The worker's jobs-per-day and hours-per-day caps are not exceeded for that
   date (`maxJobsPerDay`, `maxWorkingHoursPerDay`).
4. No existing non-cancelled `Booking` for the same worker overlaps
   `[start - requiredLeadBuffer, end + requiredTrailBuffer)`, where the buffer
   includes: pack-down time from the *previous* booking, travel time from the
   previous booking's location to this one, this booking's own setup time,
   and — symmetrically — the same for the *next* booking (setup/pack-down +
   travel back or onward). This is computed as a single interval-overlap
   check against a materialised "busy interval" per existing booking, so it
   is a pure function, easy to unit test, and cannot double-book by
   construction (it rejects, it does not "detect after the fact").
5. No connected external calendar (`CalendarConnection`) busy block overlaps
   the same buffered interval.
6. If the service requires a driver, at least one driver is plausibly
   available for the corresponding `DriverJob` window (soft check at
   offer-time; a hard check happens again at confirmation time, since driver
   availability can change between offer and confirmation).

Any attempt to persist a `Booking` bypassing `assertNoConflict()` is
prevented at the service layer (`services/bookingService.ts` never writes a
`CONFIRMED`/`AWAITING_WORKER_APPROVAL` booking without calling it first), and
is covered by the double-booking unit tests in
`domain/booking/__tests__/availability.test.ts`.
