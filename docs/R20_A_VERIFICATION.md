# R20-A Verification

R20-A establishes the Career Intelligence report-platform foundation.

Verified before commit:

- Prisma schema validation and client generation passed.
- Monorepo lint passed.
- Monorepo type-check passed.
- R20 report-platform focused tests passed.
- Database regression suite passed.
- Web regression suite passed.
- API suite passed when excluding one unchanged R19.1 date-sensitive fixture.
- Full monorepo build passed.
- Complete migration history, including the additive R20 migration, passed on a disposable PostgreSQL database.
- Production database, production containers and Nginx were not used.

## Existing R19.1 test issue

`apps/api/src/platform-admin/platform-admin.service.spec.ts` contains an unchanged fixture whose invitation expires at `2026-09-01T10:00:00Z` while expecting lifecycle status `PENDING`.

After September 1, 2026, production logic correctly classifies that fixture as `EXPIRED`.

The fixture was deliberately not altered as part of R20-A because it is unrelated to the R20 report-platform implementation.

## R20-A scope

R20-A adds the durable foundation for:

- canonical candidate mobile numbers;
- automatic report configuration;
- attempt-level report generation state;
- independent third-party report access grants;
- tenant/counsellor report-credit wallets;
- immutable credit ledger;
- candidate-counsellor assignment;
- scoped report search;
- centralized full-report access policy;
- report-credit administration primitives;
- delegated report permissions;
- legacy report-release compatibility.

Automatic execution and final candidate/admin UX are subsequent R20 phases.
