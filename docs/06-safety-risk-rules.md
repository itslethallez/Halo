# Safety Risk Rule Structure

Implemented in `domain/risk/riskEngine.ts`. Pure function:
`recommendClientStatus(input: RiskEngineInput): RiskRecommendation`, fed by
the worker safety survey (and, separately, admin-filed incidents). It never
reads or considers protected personal characteristics — its inputs are
restricted to a typed `RiskEngineInput` shape that only contains behavioural/
safety/payment/booking-accuracy fields, so there is no field to misuse.

## Client statuses

`TRUSTED`, `STANDARD`, `MONITOR`, `MANUAL_REVIEW_REQUIRED`, `RESTRICTED`,
`DO_NOT_BOOK`, `BLOCKED_PENDING_INVESTIGATION`.

## Inputs considered (from `WorkerSafetySurvey`)

- Q1 safety/comfort answer
- Q2 boundary-respect answer
- Q3 booking-accuracy answer (were client/location/circumstances as
  described)
- Q4 issue-severity answer (safety/access/payment/behavioural)
- Q5 future-booking answer + selected additional conditions
- Prior `ClientSafetyStatusHistory` (for repeat-offense escalation)
- Prior incident count within a rolling window

## Rule set

1. **Fully positive** (Q1=`Yes, completely`, Q2=`Yes, completely`,
   Q3=`Yes, everything was accurate`, Q4=`No issues`, Q5=`Yes`) → recommend
   `TRUSTED` if the client already has ≥2 completed bookings with no prior
   negative marks, else `STANDARD`. Applied automatically.
2. **Minor concern** (any answer at the "mostly / minor" tier, Q4=`Minor
   issue`) → add an internal note; recommend `MONITOR`. Applied
   automatically, but visible on the admin safety-review list for awareness.
3. **Repeated minor concerns**: if this is the **second or later** minor-tier
   survey for the same client within the last 12 months, escalate the
   recommendation one tier (`MONITOR` → `MANUAL_REVIEW_REQUIRED`). This
   implements "repeated minor concerns... should increase the client's risk
   level" without a single minor note ever being fatal on its own.
4. **Significant concern** (Q3=`Some important details were different` or
   Q4=`Significant issue requiring future bookings to be reviewed`, or
   Q5=`Manual approval should be required`) → recommend
   `MANUAL_REVIEW_REQUIRED`. This is a *pending recommendation*: it is shown
   to an admin, and the client's effective bookable status does not change
   until an admin confirms or overrides it (see `04-user-flows.md` §6).
5. **"No, do not accept future bookings" (Q5)** → recommend
   `RESTRICTED`, and forces a `SAFETY_REVIEW` on the booking that generated
   it (routed to `04-user-flows.md`'s status-change flow). Requires admin
   confirmation to finalize, but a `RESTRICTED`-or-worse recommendation
   immediately suspends *new automatic bookings* for that client pending
   review (fail-safe: block first, confirm after).
6. **Serious incident** (Q4=`Serious incident—this client should not be
   booked again`, or Q3=`No, the booking information was misleading`) →
   recommend `BLOCKED_PENDING_INVESTIGATION`. Automatic booking is disabled
   immediately; requires an administrator to review before *any* future
   booking (manual or automatic) can be created for this client. This is the
   one case where "block first" applies even more strictly — the client
   cannot self-serve a new booking at all until reviewed.
7. **Additional conditions** (from Q5's condition list) are stored as
   `ClientRestriction` rows (e.g. `DRIVER_MUST_REMAIN_NEARBY`,
   `DEPOSIT_REQUIRED`, `DO_NOT_ALLOCATE_TO_SAME_WORKER`, `CUSTOM`) and are
   enforced going forward by the booking engine (e.g.
   `DO_NOT_ALLOCATE_TO_SAME_WORKER` removes that worker from the client's
   selectable-worker list; `DEPOSIT_REQUIRED` forces `AWAITING_DEPOSIT` even
   if the business default doesn't require one).
8. **A later positive survey never silently overwrites a serious prior
   finding.** The engine always computes
   `finalStatus = worseOf(currentEffectiveStatus, newRecommendation)` for
   `RESTRICTED` and above — moving a client *up* out of one of those tiers is
   only ever a distinct, explicit admin action
   (`services/clientSafetyService.reviewAndClear()`), never a side effect of
   a new survey. A subsequent good appointment can support an admin's
   decision to lift a restriction, but cannot do it by itself.
9. Every application of a rule (automatic or admin-confirmed) writes a
   `ClientSafetyStatusHistory` row with `fromStatus`, `toStatus`, `reason`
   (which rule fired), `changedByUserId` (`null`/`SYSTEM` for automatic,
   the admin's id for confirmed/overridden), timestamp.

## Severity → automation matrix

| Outcome tier | Applied automatically? | Blocks new bookings immediately? | Needs admin to finalize/clear? |
|---|---|---|---|
| Fully positive | Yes | No | No |
| Minor / repeated minor | Yes (note + MONITOR/escalation) | No | No |
| Significant | No (recommendation only) | No (but flagged) | Yes |
| "Do not accept" (Q5) | Partial (blocks new auto-bookings) | Yes | Yes, to finalize as RESTRICTED/etc. |
| Serious incident | Partial (blocks all new bookings) | Yes | Yes, mandatory before any future booking |

## Client-satisfaction survey → review tasks (separate, lighter-weight path)

Negative client-satisfaction answers never touch `ClientSafetyStatusHistory`
or the worker's record directly. They create a review record
(`SafetyIncident.source = CLIENT_FEEDBACK`) visible to admins. An admin may
choose to act on a worker's standing, but that is a distinct manual HR-type
action outside this engine — the spec is explicit that a worker must not be
automatically punished from client feedback.
