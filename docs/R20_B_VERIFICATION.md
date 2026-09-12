# R20-B Verification

## Implemented behavior

R20-B preserves the R20-A schema and builds the normal automatic report lifecycle on it:

- submission remains authoritative and deterministic scoring still runs after the submission transaction;
- one internal processor resolves the active report configuration and reuses the governed norm, CareerFit, interpretation, and immutable snapshot services;
- generation state is persisted per attempt with safe blocked/failed behavior, retry counters/timestamps, and system-attributed audit actions;
- repeated processing reuses existing scientific applications/runs/snapshots and immediately returns an already linked generated snapshot;
- normal generation creates no `AssessmentReportRelease`;
- candidates receive a concise, candidate-owned short result without payment;
- full report JSON/PDF is entitlement-gated for commercial candidates, administratively available to properly permitted central administrators, and independently grant/scope-gated for tenant staff and counsellors;
- commerce status reflects scoring, processing, configuration, failure, ready-locked, and unlocked state rather than release rows;
- the candidate completion screen shows the free summary, report unlock/open/download actions, counselling, and another-assessment actions;
- staff see automatic processing/generated/configuration-required/failed states, with historical releases retained only as legacy history; and
- configuration readiness and generation errors are visible to authorized administrators.

No schema or migration change was required. No scientific configuration was created or inferred. The existing worker remains health-only; R20-B uses the same inline processor after scoring and exposes an authenticated, scoped central-admin retry action. PDF rendering is request-time and is not required for short-result availability.

## Verification commands

Run from the repository root unless a command says otherwise:

```text
pnpm --filter @edumall/database prisma:validate
pnpm lint
pnpm type-check
pnpm --filter @edumall/api test
pnpm --filter @edumall/web test
pnpm build
```

Focused R20-B API coverage includes automatic success, zero-release generation, configured scientific IDs, idempotent reuse, blocked configuration, sanitized failure, retry, candidate-owned short-result projection, locked/unlocked commerce status, centralized candidate/admin/tenant/counsellor policy, immutable snapshot opening, and PDF rendering. Existing scoring, commerce-adjacent authorization, public signup/mobile, duplicate-email, legacy release, report-data, CareerFit, and report PDF suites remain part of regression verification.

The known date-sensitive test in `apps/api/src/platform-admin/platform-admin.service.spec.ts` is intentionally unchanged. Its September 1, 2026 invitation fixture now correctly evaluates as expired while the assertion expects pending; this is unrelated to R20-B.

## Remaining R20-C work

- Rich in-app rendering/navigation for the complete premium report beyond the R20-B summary and protected PDF experience.
- Tenant/counsellor self-service credit purchase and operational UX on top of R20-A wallets/grants.
- Counselling booking, scheduling, fulfilment, and entitlement lifecycle.
- Durable queue/outbox recovery integration when the worker supports application jobs; it must call the same processor rather than duplicate orchestration or expose internal unauthenticated HTTP.
- OTP, only if separately approved.
