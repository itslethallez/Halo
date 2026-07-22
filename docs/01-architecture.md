# TrueReach — System Architecture

## 1. Overview

TrueReach is a booking, safety, driver-dispatch and business-management platform for
independent mobile massage workers and massage businesses. Version 1 is shipped as a
**responsive Progressive Web App (PWA)** so a single codebase serves phone, tablet and
desktop. Native iOS/Android apps are a later-release concern (see `09-folder-structure.md`
for how the codebase is arranged to make that split easy later).

## 2. High-level component diagram

```
                              ┌─────────────────────────────┐
                              │        Client browser        │
                              │   (Next.js PWA, installable) │
                              └───────────────┬───────────────┘
                                              │ HTTPS
                              ┌───────────────▼───────────────┐
                              │         Next.js App            │
                              │  - App Router pages/layouts    │
                              │  - Server Actions / Route      │
                              │    Handlers (typed API)        │
                              │  - RBAC middleware              │
                              └───────┬───────────────┬────────┘
                                      │               │
                     ┌────────────────▼───┐   ┌───────▼─────────────┐
                     │   Domain / Service   │   │  Background Jobs     │
                     │   layer (pure TS)    │   │  (reminders, survey  │
                     │  - booking engine    │   │  nudges, missed      │
                     │  - risk engine       │   │  check-in alerts)    │
                     │  - driver allocation │   └───────┬─────────────┘
                     │  - financial calcs   │           │
                     └────────┬─────────────┘           │
                              │                          │
                     ┌────────▼──────────────────────────▼────────┐
                     │              Prisma ORM                      │
                     └────────────────────┬──────────────────────┘
                                          │
                                ┌─────────▼─────────┐
                                │     PostgreSQL      │
                                └────────────────────┘

        ┌───────────────────────── Integration adapters ─────────────────────────┐
        │  Calendar (Google, extensible)   SMS   Email   WhatsApp   Payments      │
        │  Maps/travel-time   Push notifications   AI language model provider    │
        │  Each integration is a small interface + swappable implementation.     │
        │  Dev/mock adapters ship by default; real adapters are enabled via env. │
        └──────────────────────────────────────────────────────────────────────┘
```

## 3. Why this stack

- **Next.js (App Router) + React + TypeScript** — one codebase for UI and typed
  server actions/route handlers, first-class PWA support, good mobile performance.
- **Tailwind CSS + shadcn/ui (Radix-based)** — accessible, themeable component
  primitives that support the "premium, calm, discreet" design direction without
  a bespoke design system.
- **PostgreSQL + Prisma** — relational integrity is essential here (bookings,
  status history, safety data, money) and Prisma gives us typed migrations.
- **Server Actions / typed Route Handlers** instead of a separate REST service —
  fewer moving parts for an MVP, while keeping a clean `services/` layer so the
  transport (REST vs RPC) can change without touching business logic.
- **Background jobs** run via a lightweight queue (BullMQ + Redis in production;
  an in-process interval-based dev runner for local/dev) so reminders, survey
  nudges and missed-check-in alerts fire even when no user is looking at a page.

## 4. Layering rules

1. **`domain/`** — pure, framework-free TypeScript. No Prisma, no HTTP, no React.
   Business rules (booking conflict checks, risk scoring, driver scoring, money
   math) live here and are unit-tested in isolation. This is what the spec calls
   "produce the booking state machine / safety-risk rules / driver-allocation
   logic / financial rules" — those documents map 1:1 to modules in this layer.
2. **`services/`** — orchestrates domain logic with persistence (Prisma) and
   integration adapters. E.g. `bookingService.createEnquiry()` calls the domain
   booking engine, then persists a `Booking` + `BookingStatusHistory` row.
3. **`integrations/`** — one folder per external capability (`calendar/`,
   `sms/`, `email/`, `payments/`, `maps/`, `push/`, `ai/`). Each exposes a small
   TypeScript interface (e.g. `CalendarProvider`) with a `google/` implementation
   and a `dev/` mock implementation, selected by env var.
4. **`app/`** — Next.js routes, layouts, server actions. Thin: validate input,
   check permissions, call a service, return a typed result.
5. **`components/`** — presentation only.

This separation is what lets the same booking-conflict logic be exercised by
unit tests without a database, and what lets an integration be swapped (e.g.
Twilio → a different SMS vendor) without touching booking logic.

## 5. Multi-tenancy

Every row of consequence hangs off a `Business`. The MVP ships with a single
seeded business, but `businessId` foreign keys are present everywhere from day
one so "multiple business locations" (a later-release feature) is additive, not
a migration nightmare.

## 6. Real-time-ish updates

MVP polls / revalidates on navigation and uses optimistic UI for status changes
initiated by the same user. Live GPS driver tracking (a later-release feature)
is left as a documented extension point (`integrations/maps/liveTracking.ts`
stub) rather than implemented, so we are not shipping a fake live-tracking map.

## 7. AI assistant

The AI assistant is a service (`domain/messaging/assistant.ts`) that:
- Reads the worker's configured tone/style and escalation rules.
- Reads calendar/availability/service data through the same services the UI
  uses (never a special "shortcut" path), so it can never offer a booking the
  booking engine itself would reject.
- Always identifies itself as an assistant ("Hi, I'm Sarah's booking
  assistant…"), never impersonates the worker.
- Hands off to a human via a `Conversation.status = NEEDS_HUMAN` flag the
  moment an escalation rule fires (abusive language, out-of-scope request,
  payment dispute, existing safety flag, uncertainty, or a worker-configured
  manual-review trigger).
- Talks to a pluggable `AiProvider` interface; the MVP ships a deterministic
  dev provider (rule/template based) plus a real-provider adapter stub so no
  LLM API key is required to run the app, and a real key can be dropped in
  later without changing calling code.

## 8. Security posture (see `10-legal-privacy-security-risks.md` for detail)

- All traffic over HTTPS (enforced by the hosting platform / reverse proxy).
- Passwords hashed with argon2id; optional TOTP-based 2FA for all roles,
  mandatory for administrators.
- RBAC enforced in one place (`lib/authz.ts`) and checked on every server
  action / route handler — never trust client-side role checks alone.
- Field-level encryption for the most sensitive columns (worker home address,
  distress phrase, private safety notes) using an application-level envelope
  (AES-256-GCM) in addition to disk/at-rest encryption from the hosting DB.
- Every mutation of a protected resource writes an `AuditLog` row (actor,
  action, target, before/after where relevant, timestamp).
