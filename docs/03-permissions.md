# Role Permission Table

Enforced centrally in `lib/authz.ts` (`can(user, action, resource)`), never
solely in the UI. Every server action / route handler calls this before doing
anything. `AuditLog` records the outcome of every check on a protected action.

Legend: ✅ full access · 🟡 limited/own-records-only · 🚫 no access

| Capability | Admin | Worker | Driver | Client |
|---|---|---|---|---|
| Manage workers (add/edit/deactivate) | ✅ | 🚫 | 🚫 | 🚫 |
| Manage drivers | ✅ | 🚫 | 🚫 | 🚫 |
| Manage services & pricing | ✅ | 🟡 own price overrides only | 🚫 | 🚫 |
| View all bookings | ✅ | 🟡 own bookings | 🟡 own transport jobs | 🟡 own bookings |
| Approve manual-review bookings | ✅ | 🟡 own bookings | 🚫 | 🚫 |
| Set own availability / calendar | 🚫 | ✅ | ✅ (availability only) | 🚫 |
| Message clients / take over AI chat | ✅ | ✅ (own clients) | 🚫 | ✅ (own conversation) |
| View client contact + booking history | ✅ | 🟡 own clients, booking-relevant fields | 🚫 | 🟡 own record only |
| View client internal safety notes | ✅ | 🚫 (sees status + restrictions only, never other workers' free-text notes) | 🚫 | 🚫 |
| Submit worker safety survey | 🚫 | ✅ (own appointments) | 🚫 | 🚫 |
| View worker safety survey answers | ✅ | 🟡 own submissions | 🚫 | 🚫 |
| Submit client satisfaction survey | 🚫 | 🚫 | 🚫 | ✅ (own appointment) |
| View client satisfaction survey answers | ✅ | 🟡 own appointments (aggregate + non-identifying where policy requires) | 🚫 | 🟡 own submissions |
| Change client safety status | ✅ | 🚫 (can *recommend* via survey; cannot set "Do not book" etc. directly) | 🚫 | 🚫 |
| Approve/block a client | ✅ | 🚫 | 🚫 | 🚫 |
| Create/allocate driver jobs | ✅ | ✅ (request only; final assignment may require admin per business rule) | 🚫 | 🚫 |
| Accept/decline own driver job | 🚫 | 🚫 | ✅ | 🚫 |
| View driver job financials (payment amount) | ✅ | 🚫 | 🟡 own job payment only | 🚫 |
| View business income/expenses/profit | ✅ | 🚫 | 🚫 | 🚫 |
| View own earnings | 🚫 | ✅ | ✅ | 🚫 |
| Configure AI tone/escalation rules | ✅ (business defaults) | ✅ (own overrides) | 🚫 | 🚫 |
| Configure booking/safety automation rules | ✅ | 🚫 | 🚫 | 🚫 |
| Access audit logs | ✅ | 🚫 | 🚫 | 🚫 |
| Manage role permissions | ✅ | 🚫 | 🚫 | 🚫 |
| Emergency/safety escalation trigger | ✅ (receives) | ✅ (own appointment) | 🚫 | 🚫 |
| Book/reschedule/cancel appointment | ✅ (any) | 🟡 own bookings, per business rule | 🚫 | 🟡 own bookings, per cancellation policy |
| View worker private address/calendar/notes | ✅ | 🟡 own only | 🚫 | 🚫 |

## Notes

- **Client isolation**: a client can never see another client's data, a
  worker's private address, private calendar events, safety notes, or
  internal rating. Enforced by scoping every client-facing query to
  `clientId = currentUser.clientId` at the service layer (not just filtering
  in the UI).
- **Worker isolation**: one worker's private notes about a client are not
  visible to another worker by default. Cross-worker visibility of safety
  status (not free-text notes) requires a business-level flag
  (`Business.shareSafetyStatusAcrossWorkers`) set by an admin, because a
  client's *safety status* legitimately needs to travel with them between
  workers at the same business, while personal narrative notes do not
  automatically need to.
- **Driver isolation**: drivers only ever receive the minimum necessary data
  for a `DriverJob` (pickup/destination, time window, special instructions
  relevant to safety/access) — never the client's full profile, survey
  answers, or payment details beyond their own driver payment.
- **Serious safety decisions require a human**: automated risk scoring can
  *recommend* a status (see `06-safety-risk-rules.md`) but only an
  authenticated Admin action can set a client to `RESTRICTED`, `DO_NOT_BOOK`
  or `BLOCKED_PENDING_INVESTIGATION` — every such change is written to
  `ClientSafetyStatusHistory` with the acting user id.
