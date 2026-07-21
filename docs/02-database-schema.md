# Database Schema

The authoritative schema is `prisma/schema.prisma`. This document explains the
entity groups and key relationships; see that file for exact fields, types,
indexes and enums.

## Entity groups

### Identity & tenancy
- **Business** — the operating company. Root of multi-tenancy.
- **User** — auth identity (email, password hash, TOTP secret, role). One
  `User` links to exactly one of `Worker` / `Driver` / `Client` profile, or is
  an `Admin` directly.
- **AuditLog** — append-only. `actorUserId`, `action`, `entityType`,
  `entityId`, `businessId`, `metadata` (JSON), `createdAt`.

### People
- **Worker** — profile, tone/style config, escalation config, travel limits,
  safety settings (distress phrase, trusted contact), private home address
  (encrypted field), bank/payout details.
- **WorkerService** — join table: which `Service`s a worker offers and at what
  price/duration override.
- **WorkerAvailability** — recurring weekly rules (day, start, end), plus
  one-off `BlockedTime` rows (blackout dates, holidays, personal events).
- **CalendarConnection** — provider (`GOOGLE` today, extensible enum),
  OAuth tokens (encrypted), sync cursor. Read/write is behind a
  `CalendarProvider` interface (see `integrations/calendar/`).
- **Driver** — profile, vehicle info, service areas, availability, rating.
- **Client** — the internal client profile (contact info, verified-contact
  flag, current safety status). This is the "internal database" the spec
  requires — never publicly searchable.
- **ClientAddress** — historical addresses used for a client (supports
  "previous addresses" and "repeatedly changes address" detection).

### Catalogue
- **Service** — name, description, base duration, base price, requires-driver
  default, business-level (not worker-level) catalogue entry.

### Booking lifecycle
- **Booking** — the central entity. FK to business, client, worker, service,
  address, assigned driver job (nullable), status (enum — see
  `05-booking-state-machine.md`), all schedule fields (requested time,
  confirmed time, travel/setup/packdown minutes), financial snapshot FKs.
- **BookingStatusHistory** — append-only, one row per transition
  (`fromStatus`, `toStatus`, `changedByUserId` nullable for system-driven
  transitions, `reason`, `createdAt`).
- **Conversation** / **Message** — chat thread tied to a booking or a
  free-standing enquiry; `Message.sender` is `AI` | `WORKER` | `CLIENT` |
  `SYSTEM`; `Conversation.needsHuman` boolean + `escalationReason`.

### Safety
- **WorkerSafetySurvey** — the 5-question private survey (answers stored as
  enums, one optional free-text note field, one `additionalConditions`
  string array). Never joined into any client-facing query.
- **ClientSatisfactionSurvey** — the 5-question client-facing survey +
  optional comment + contact-me-back boolean.
- **SafetyIncident** — free-standing incident reports (can exist without a
  survey, e.g. reported directly by a worker or admin).
- **ClientRestriction** — active conditions on a client (one row per
  condition, e.g. `DRIVER_MUST_REMAIN_NEARBY`), each with `createdBy`,
  `createdAt`, optional `expiresAt`.
- **ClientSafetyStatusHistory** — append-only log of every status change
  (`fromStatus`, `toStatus`, `changedByUserId`, `reason`, `createdAt`) —
  answers "who changed it and when" per the spec.

### Driver dispatch
- **DriverJob** — one transport job per booking-leg (outbound, and return if
  required), FK to booking, worker, driver (nullable until assigned), status
  enum (see `07-driver-allocation.md`), payment amount, special instructions,
  safety requirements (derived from `ClientRestriction`s).
- **DriverStatusHistory** — append-only transition log, same shape as
  booking status history.

### Money
- **Payment** — one row per client payment (deposit, balance, tip), provider
  reference id, status, fee.
- **Refund** — linked to a `Payment`.
- **Expense** — business-level or booking-level (fuel, tolls, supplies, etc).
- **DriverPayment** — what the business paid a driver for a `DriverJob`.
  Booking-level financial rollups are *computed*, not stored redundantly,
  except for a small denormalised `BookingFinancials` snapshot used for fast
  reporting (regenerated from source rows, never hand-edited).

### Notifications
- **Notification** — polymorphic (`userId`, `type`, `channel`, `payload`,
  `status`, `sentAt`, `readAt`).

## Key indexes

- `Booking(workerId, scheduledStart)` — availability/conflict queries.
- `Booking(businessId, status)` — dashboard "today's bookings" queries.
- `DriverJob(driverId, status)` — driver dashboard.
- `ClientSafetyStatusHistory(clientId, createdAt)`.
- `AuditLog(businessId, createdAt)`, `AuditLog(entityType, entityId)`.
- Unique constraint `WorkerAvailability(workerId, dayOfWeek)` for recurring
  rules; `CalendarConnection(workerId, provider)` unique.

## Encryption of sensitive fields

Applied at the Prisma-client boundary via a thin field-encryption helper
(`lib/crypto/field.ts`), not at the column-type level, so it is explicit at
every call site:
- `Worker.homeAddressEncrypted`
- `Worker.distressPhraseEncrypted`
- `CalendarConnection.accessTokenEncrypted` / `refreshTokenEncrypted`
- `WorkerSafetySurvey.privateNotesEncrypted`
