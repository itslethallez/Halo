# MVP Folder Structure

```
truereach/
├── docs/                          # This design documentation
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                    # Realistic demo data (1 business, several workers/drivers/clients)
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # login, register, 2FA setup
│   │   ├── (marketing)/           # public booking landing, privacy policy, terms
│   │   ├── admin/                 # admin dashboard + sub-pages
│   │   ├── worker/                # worker dashboard + sub-pages
│   │   ├── driver/                # driver dashboard + sub-pages
│   │   ├── client/                # client booking + account pages
│   │   ├── api/                   # route handlers (webhooks, CSV export, health)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives
│   │   ├── dashboards/
│   │   ├── booking/
│   │   └── surveys/
│   ├── domain/                    # PURE business logic, framework-free, unit-tested
│   │   ├── booking/
│   │   │   ├── availability.ts
│   │   │   ├── statusMachine.ts
│   │   │   └── __tests__/
│   │   ├── risk/
│   │   │   ├── riskEngine.ts
│   │   │   └── __tests__/
│   │   ├── driver/
│   │   │   ├── allocation.ts
│   │   │   ├── statusMachine.ts
│   │   │   └── __tests__/
│   │   ├── finance/
│   │   │   ├── calculations.ts
│   │   │   └── __tests__/
│   │   └── messaging/
│   │       ├── assistant.ts
│   │       └── __tests__/
│   ├── services/                  # Orchestration: domain + Prisma + integrations
│   │   ├── bookingService.ts
│   │   ├── clientSafetyService.ts
│   │   ├── driverService.ts
│   │   ├── surveyService.ts
│   │   ├── reportingService.ts
│   │   ├── notificationService.ts
│   │   └── auditService.ts
│   ├── integrations/               # One folder per external capability
│   │   ├── calendar/
│   │   │   ├── CalendarProvider.ts  # interface
│   │   │   ├── google/
│   │   │   └── dev/                 # mock/dev adapter, no real credentials needed
│   │   ├── sms/
│   │   ├── email/
│   │   ├── whatsapp/
│   │   ├── payments/
│   │   ├── maps/
│   │   ├── push/
│   │   └── ai/
│   ├── lib/
│   │   ├── authz.ts                # RBAC checks
│   │   ├── auth.ts                 # NextAuth config
│   │   ├── crypto/                 # field-level encryption helpers
│   │   ├── csv.ts
│   │   ├── currency.ts
│   │   ├── prisma.ts
│   │   └── rateLimit.ts
│   ├── jobs/                        # Background job definitions + dev runner
│   │   ├── reminders.ts
│   │   ├── surveyNudges.ts
│   │   └── missedCheckIns.ts
│   └── types/
├── tests/                           # Integration/e2e-ish tests spanning services
├── .env.example
├── package.json
└── README.md
```

## Why this shape supports later features without rewrites

- **Native mobile apps**: `domain/` and `services/` have zero Next.js/React
  dependency, so a future React Native or native client calls the same
  services through typed route handlers without duplicating business logic.
- **Multiple business locations**: every domain/service function already
  takes/derives a `businessId`; no function assumes a single global business.
- **Additional calendar/SMS/payment providers**: adding one is "implement the
  interface in a new subfolder + register in the provider factory", never a
  change to booking/service code.
- **Route optimisation / live tracking**: `integrations/maps/` has documented
  extension points (`estimateTravelTime` today, `optimizeRoute` and
  `streamLiveLocation` stubbed with `NotImplementedError` and a comment
  pointing at this doc) rather than fake implementations.
