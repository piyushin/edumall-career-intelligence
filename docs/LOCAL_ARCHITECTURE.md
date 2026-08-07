# Local Architecture

Phase 0 runs a TypeScript monorepo with three applications and shared packages.

```text
apps/web      Next.js status page and UI foundation
apps/api      NestJS API with health/readiness endpoints
apps/worker   TypeScript worker with BullMQ-ready structure

packages/config         Environment validation and structured logging
packages/database       Prisma schema, client helper, and migrations
packages/shared-types   Shared health, readiness, and error types
packages/ui             Accessible UI component foundation
```

Local supporting services:

- PostgreSQL for database connectivity and Prisma validation.
- Redis for readiness checks and worker queue readiness.

The API exposes:

- `GET /health`
- `GET /ready`

The web app exposes:

- `/`
- `/status`

No Phase 0 code implements assessment, scoring, recommendation, reporting, payment, authentication, users, or tenants.
