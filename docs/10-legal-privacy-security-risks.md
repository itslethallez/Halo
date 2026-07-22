# Legal, Privacy & Security Risk Register

This platform processes health-adjacent, location, financial and personal-
safety data about real people. This document is a starting risk register, not
a legal opinion — a qualified Australian privacy/employment lawyer should
review before commercial launch.

## Privacy (Australian Privacy Principles — APP)

1. **Sensitive information**: massage/therapeutic-service booking data can
   arguably touch on health information for some clients. Treat all client
   booking and survey data as sensitive by default (APP 3 heightened consent
   requirements), even though the service is not a registered health service.
2. **Collection notice / consent (APP 1, 3, 5)**: the booking flow and worker
   onboarding must show a clear collection notice describing what's collected
   and why (contact details, address, safety survey answers, location during
   safety check-ins) before first use. Modelled as a `ConsentRecord` the user
   accepts, versioned against the current Privacy Policy.
3. **Use/disclosure limits (APP 6)**: a client's safety-survey-derived status
   must not be disclosed outside the business without explicit legal basis;
   the "business-to-business safety sharing" later-release feature is
   explicitly out of MVP scope pending its own legal review, per the spec.
4. **No public blacklist (explicit spec requirement)**: client safety status
   is never exposed via any public or client-facing endpoint — enforced by
   keeping it out of every client-facing DTO, not just the UI.
5. **Access & correction (APP 12/13)**: clients must be able to request a
   copy of, or correction to, their internal record. Modelled as an admin-
   mediated `DataCorrectionRequest` workflow (no self-service edit of
   safety-relevant fields, to prevent tampering with survey history — but a
   clear escalation path to a human).
6. **Cross-border storage**: if hosting infra is outside Australia, this must
   be disclosed in the privacy policy (APP 8) and contractually controlled.
7. **Data retention & deletion**: `Business.dataRetentionPolicy` config +
   scheduled purge job for data past its retention window, and an explicit
   account-deletion request flow, balanced against needing to retain safety-
   incident records for legitimate business/legal reasons (retain a minimal
   safety-relevant record, anonymise the rest, and clearly document this
   trade-off in the privacy policy rather than silently keeping everything).

## Employment / work-status risk

8. Independent massage workers are most likely engaged as **contractors**,
   not employees — but heavy platform control (fixed pricing, mandatory
   scripts, mandatory check-ins as a condition of "working") can shift that
   characterisation under Australian employment law (the "multi-factor
   test", and gig-economy scrutiny is active in Australia). Recommend legal
   review of the contractor agreement in parallel with product design;
   the product should keep worker-side configuration (pricing, hours, tone)
   *worker-controlled* wherever feasible rather than platform-dictated,
   which also happens to be better product design.

## Safety / duty-of-care

9. **Not a substitute for emergency services**: the "emergency button" and
   safety check-ins are a *risk-reduction* tool (notify trusted contact/
   admin/driver), not a 000/monitored-alarm replacement. UI copy must say
   this explicitly to avoid over-promising safety guarantees.
10. **Defamation risk in worker survey notes**: private notes about a client
    (especially "serious incident" markers) are a defamation/negligent-
    misstatement risk if inaccurate and later relied upon to deny service.
    Mitigate with: mandatory objective-language guidance in the survey UI,
    an audit trail of who wrote what and when, and the correction process
    above.
11. **Discrimination risk**: the risk engine must never take protected
    characteristics as input (see `06-safety-risk-rules.md`); this is a
    hard architectural constraint (typed input shape), not just a policy.

## Security

12. **Location data** (worker home address, live check-in location,
    distress phrase) is the single highest-impact data category if breached
    — field-level encryption, tightly scoped access, and audit logging on
    every read of a worker's home address are required, not optional.
13. **Payment data**: never store raw card numbers — all payment collection
    goes through the payment provider's hosted fields/tokenisation; the
    platform only ever stores a provider reference id and amounts (PCI-DSS
    SAQ-A posture).
14. **2FA & session security**: mandatory 2FA for admin accounts (highest
    blast radius), optional-but-encouraged for workers/drivers, short-lived
    session tokens with rotation on privilege-sensitive actions.
15. **Rate limiting & abuse**: public booking/enquiry endpoints are
    unauthenticated by nature — rate limit per IP/phone/email to prevent
    enumeration or spam booking creation, and validate all input server-side
    even though client-side validation exists too.
16. **Audit logging** covers every read of a "sensitive" field category
    (worker private address, safety notes) in addition to every write, so an
    inappropriate access can be detected even if no data was changed.
17. **Third-party adapter credentials**: all external API keys live in
    environment variables only (see `.env.example`), never committed, and
    dev adapters are the default so the app runs and is testable without any
    real credentials.

## Product-scope guardrails baked into the build

- The AI assistant is contractually/technically barred from claiming to be
  the worker (see `01-architecture.md` §7) — this is both a trust issue and
  a potential misleading-conduct (Australian Consumer Law) issue if handled
  poorly.
- Automatic serious safety actions (`RESTRICTED`+) always require human
  confirmation before they affect a real client's ability to book, per
  `06-safety-risk-rules.md` — this limits liability from a purely automated
  adverse decision against a person.
