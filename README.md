# EduMall Career Intelligence Platform

This repository contains The EduMall Career Intelligence Platform, starting with the Phase 0 engineering foundation. The approved product direction is documented in:

- [docs/SRS.md](docs/SRS.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DECISION_LOG.md](docs/DECISION_LOG.md)
- [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md)

Phase 0 creates a TypeScript monorepo with a Next.js web app, NestJS API, TypeScript worker, shared packages, PostgreSQL/Redis local services, Prisma, Docker, GitHub Actions, and engineering documentation.

## Package Manager

This monorepo uses **pnpm workspaces** and **Turborepo**. pnpm provides deterministic workspace dependency management and efficient installs. Turborepo coordinates builds, tests, linting, and type-checking across apps and packages.

## Local Startup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy local environment placeholders:

   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   cp apps/worker/.env.example apps/worker/.env
   ```

3. Start PostgreSQL and Redis:

   ```bash
   pnpm services:up
   ```

4. Generate the Prisma client:

   ```bash
   pnpm prisma:generate
   ```

5. Apply local database migrations:

   ```bash
   pnpm db:migrate:local
   ```

6. Start apps:

   ```bash
   pnpm dev:web
   pnpm dev:api
   pnpm dev:worker
   ```

## Common Commands

```bash
pnpm format:check
pnpm lint
pnpm type-check
pnpm test
pnpm build
pnpm security:audit
pnpm services:down
```

## Phase 0 Boundaries

This phase does not implement authentication, users, tenants, assessments, question banks, scoring, report generation, payments, career recommendation, psychometric interpretation, cloud deployment, or production infrastructure.

## Architecture Decision References

The current approved decisions are in [docs/DECISION_LOG.md](docs/DECISION_LOG.md). Open issues for CTO, product, psychometric, legal, content, infrastructure, and operations review are tracked in [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md).
