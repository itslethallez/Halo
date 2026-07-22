# Halo

A secure, professional booking, safety, driver-dispatch and business-management platform for
independent mobile massage workers and massage businesses. Built as a responsive Progressive
Web App with Next.js, TypeScript, Prisma and PostgreSQL.

Start with the design documents in [`/docs`](./docs) — they cover the architecture, database
schema, permission table, user flows, booking state machine, safety-risk rules, driver-allocation
logic, financial rules, folder structure, and a legal/privacy/security risk register. This
codebase is the staged implementation that follows from those documents.

## What's implemented (MVP)

- Secure login (scrypt password hashing, optional TOTP 2FA), role-based access control for
  Admin / Worker / Driver / Client, session cookies via encrypted JWTs.
- A booking/availability engine (`src/domain/booking`) that never double-books a worker —
  it accounts for working hours, breaks, blackout dates, daily caps, minimum notice/advance
  windows, and setup/pack-down/travel buffers around every existing commitment.
- A safety-survey risk engine (`src/domain/risk`) that turns the private worker safety survey
  into a client-status recommendation, with serious outcomes always requiring an explicit admin
  action to finalize (never fully automatic).
- A driver-allocation engine (`src/domain/driver`) that ranks candidate drivers by availability,
  distance, service area, rating, worker preference, cost and current load.
- Financial calculations (`src/domain/finance`) for per-booking net profit and the full set of
  aggregate reports the spec requires (revenue by worker/service/suburb, cancellation/no-show/
  repeat-client rates, etc.), all derived from the same source rows.
- An AI booking-assistant layer (`src/domain/messaging`, `src/integrations/ai`) that always
  discloses it is an assistant (never impersonates the worker) and escalates to a human on
  abusive language, out-of-scope requests, payment disputes, existing safety flags, repeated
  identity/address changes, low confidence, or a worker-configured manual-review trigger.
- Four dashboards (`src/app/{admin,worker,driver,client}`) backed by real Prisma queries and
  server actions — not mockups.
- A public booking page (`/book`) that only ever offers genuinely available slots (computed by
  the same availability engine used everywhere else) and includes a live demo of the AI
  assistant, including its escalation behaviour.
- Modular integration adapters (`src/integrations/*`) for Google Calendar, SMS (Twilio-shaped),
  email (Resend-shaped), WhatsApp Business, payments (Stripe-shaped), maps/travel-time (Google
  Distance Matrix-shaped) and push (Web Push/VAPID) — each ships a working DEV/MOCK adapter that
  requires no credentials, plus a "live" adapter that throws a clear error if its required
  env vars aren't set, so nothing fakes being a real integration.

## Getting started

```bash
cp .env.example .env          # fill in AUTH_SECRET / FIELD_ENCRYPTION_KEY (see comments in the file)
npm install
npm run prisma:migrate        # creates the schema in your local Postgres
npm run prisma:seed           # realistic demo data — see credentials printed at the end
npm run dev                   # http://localhost:3000
```

Requires a local PostgreSQL instance (`DATABASE_URL` in `.env`). Everything else runs in
`INTEGRATION_MODE=dev` (the default) with zero external credentials.

Demo login after seeding — password `DemoPass123!` for every account:
- Admin: `admin@serenitymobile.example`
- Workers: `sarah@…`, `max@…`, `lena@serenitymobile.example` (different AI tone per worker)
- Drivers: `omar@…`, `hana@serenitymobile.example`
- Clients: `alice.client@…`, `ben.client@…`, `cara.client@…`, `david.client@example.com`

## Testing

```bash
npm run typecheck
npm test
```

`npm test` runs 116 Vitest tests: pure unit tests for every domain module (booking conflicts,
double-booking prevention, the booking/driver state machines, risk-engine rules, driver
allocation scoring, financial calculations, assistant escalation rules) plus integration tests
against a real Postgres database for survey submission, safety-status updates, manual-review
rules, payment-status changes, missed safety check-ins, and private-client-notes access control.
Integration tests run against `halo_test` (a separate database from your dev/seeded one) —
create it once with `createdb halo_test` and apply migrations with
`DATABASE_URL=postgresql://.../halo_test npx prisma migrate deploy`.

## What's intentionally not built yet

Per `/docs/09-folder-structure.md`, native mobile apps, automatic driver route optimisation,
live GPS tracking, multi-language messaging, identity verification, and
business-to-business safety sharing are later-release features. The maps integration exposes
`optimizeRoute`/`streamLiveLocation` as documented extension points that throw
`NotImplementedError` rather than faking a result.
